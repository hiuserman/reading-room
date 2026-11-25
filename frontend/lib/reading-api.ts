import { getAccessToken } from "../app/auth/session";

export type ReadingStatus = "reading" | "paused" | "finished";
export type Profile = { user_id: string; display_name: string; created_at: string };
export type Shelf = { shelfId: string; name: string };
export type Member = { userId: string; displayName: string };
export type ShelfDetail = Shelf & { members: Member[]; inviteCode?: string };
export type Book = {
  shelfId: string; bookId: string; title: string; authors: string[];
  addedBy: string | null; createdAt: string; coverUrl: string | null;
};
export type ReadingRecord = {
  shelfId: string; bookId: string; userId: string; status: ReadingStatus;
  currentPage: number | null; updatedAt: string; finishedAt: string | null; version: number;
};
export type Post = {
  shelfId: string; postId: string; bookId: string; userId: string;
  status: ReadingStatus; currentPage: number | null; comment: string;
  containsSpoiler: boolean; createdAt: string;
  book: Pick<Book, "bookId" | "title" | "authors" | "coverUrl">;
  user: Member;
};
export type Page<T> = { items: T[]; nextCursor: string | null };
export type PostInput = {
  bookId: string; status: ReadingStatus; currentPage: number | null;
  comment: string; containsSpoiler: boolean; expectedVersion: number;
};
export type CreatePostResult = { post: Post; readingRecord: ReadingRecord };

// These endpoints are a proposed contract, not deployed capabilities.
// Turn this build-time flag on only after the Go routes and authorization are ready.
export const readingApiEnabled = process.env.NEXT_PUBLIC_READING_API_ENABLED === "true";
const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

type Guard<T> = (value: unknown) => value is T;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const nonempty = (value: unknown): value is string => text(value) && value.trim().length > 0;
const nullableText = (value: unknown): value is string | null => value === null || text(value);
const date = (value: unknown): value is string => nonempty(value) && Number.isFinite(Date.parse(value));
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const status = (value: unknown): value is ReadingStatus => value === "reading" || value === "paused" || value === "finished";
const currentPage = (value: unknown): value is number | null => value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2147483647);
const version = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const profileGuard = (value: unknown): value is Profile => object(value) && nonempty(value.user_id) && nonempty(value.display_name) && date(value.created_at);
const shelfGuard = (value: unknown): value is Shelf => object(value) && nonempty(value.shelfId) && nonempty(value.name);
const memberGuard = (value: unknown): value is Member => object(value) && nonempty(value.userId) && nonempty(value.displayName);
const shelfDetailGuard = (value: unknown): value is ShelfDetail => object(value) && Array.isArray(value.members) && value.members.every(memberGuard) && (value.inviteCode === undefined || nonempty(value.inviteCode)) && shelfGuard(value);
const bookSummaryGuard = (value: unknown): value is Post["book"] => object(value) && nonempty(value.bookId) && nonempty(value.title) && strings(value.authors) && nullableText(value.coverUrl);
const bookGuard = (value: unknown): value is Book => object(value) && nonempty(value.shelfId) && nullableText(value.addedBy) && date(value.createdAt) && bookSummaryGuard(value);
const recordGuard = (value: unknown): value is ReadingRecord => object(value) && nonempty(value.shelfId) && nonempty(value.bookId) && nonempty(value.userId) && status(value.status) && currentPage(value.currentPage) && date(value.updatedAt) && (value.finishedAt === null || date(value.finishedAt)) && version(value.version);
const postGuard = (value: unknown): value is Post => object(value) && nonempty(value.shelfId) && nonempty(value.postId) && nonempty(value.bookId) && nonempty(value.userId) && status(value.status) && currentPage(value.currentPage) && text(value.comment) && typeof value.containsSpoiler === "boolean" && date(value.createdAt) && bookSummaryGuard(value.book) && memberGuard(value.user) && value.bookId === value.book.bookId && value.userId === value.user.userId;
const createPostGuard = (value: unknown): value is CreatePostResult => object(value) && postGuard(value.post) && recordGuard(value.readingRecord) && value.post.shelfId === value.readingRecord.shelfId && value.post.bookId === value.readingRecord.bookId && value.post.userId === value.readingRecord.userId;
function pageGuard<T>(itemGuard: Guard<T>): Guard<Page<T>> {
  return (value): value is Page<T> => object(value) && Array.isArray(value.items) && value.items.every(itemGuard) && (value.nextCursor === null || nonempty(value.nextCursor));
}

function responseError(httpStatus: number, data: unknown, path: string): ApiError {
  // Never expose arbitrary backend error/stack strings. Only map known errors.
  const error = object(data) ? data.error : undefined;
  const code = object(error) && text(error.code) ? error.code : undefined;
  if (httpStatus === 404 && path === "/api/me" && error === "プロフィールが未登録です") {
    return new ApiError(404, "PROFILE_NOT_FOUND", "表示名を登録して、はじめましょう。");
  }
  if (httpStatus === 401) return new ApiError(401, "UNAUTHORIZED", "ログインの有効期限が切れました。もう一度ログインしてください。");
  if (httpStatus === 403) return new ApiError(403, "FORBIDDEN", "この本棚にアクセスできません。参加先を確認してください。");
  if (httpStatus === 404) return new ApiError(404, "NOT_FOUND", "目的の情報が見つかりません。画面を更新して確認してください。");
  if (httpStatus === 409) return new ApiError(409, code === "IDEMPOTENCY_CONFLICT" ? code : "CONFLICT", path === "/api/me" ? "プロフィールはすでに登録されています。保存済みの情報を確認してください。" : "情報が更新されています。最新の内容を確認してから操作してください。");
  if (httpStatus === 400 || httpStatus === 422) return new ApiError(httpStatus, "VALIDATION_ERROR", "入力内容を確認してください。文字数やページ数に誤りがないか確認できます。");
  if (httpStatus === 413) return new ApiError(413, "PAYLOAD_TOO_LARGE", "入力内容が長すぎます。短くしてもう一度お試しください。");
  if (httpStatus === 429) return new ApiError(429, "RATE_LIMITED", "アクセスが集中しています。少し待ってからお試しください。");
  if (httpStatus === 501) return new ApiError(501, "FEATURE_UNAVAILABLE", "この機能は準備中です。");
  return new ApiError(httpStatus, "SERVICE_ERROR", "現在、通信を完了できません。時間をおいて確認してください。");
}

type RequestOptions = { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal; idempotencyKey?: string; planned?: boolean };
async function request<T>(path: string, guard: Guard<T>, options: RequestOptions = {}): Promise<T> {
  if (options.planned && !readingApiEnabled) throw new ApiError(501, "FEATURE_UNAVAILABLE", "本棚と読書記録は準備中です。完成イメージは見本で確認できます。");
  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), 12000);
  const mutation = options.method === "POST";
  try {
    const token = await getAccessToken();
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (!token) throw new ApiError(401, "UNAUTHORIZED", "ログインしてからご利用ください。");
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET", headers, cache: "no-store", credentials: "omit",
      body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) throw responseError(response.status, data, path);
    if (!guard(data)) throw new ApiError(502, "INVALID_RESPONSE", mutation ? "保存結果を確認できませんでした。重ねて登録する前に、保存済みの情報を確認してください。" : "受信した情報を表示できませんでした。時間をおいて確認してください。");
    return data;
  } catch (error) {
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, controller.signal.aborted ? "TIMEOUT" : "NETWORK_ERROR", mutation ? "保存結果を確認できませんでした。通信を確認し、保存済みの情報を確認してください。" : "通信できませんでした。接続を確認してもう一度お試しください。");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

function pagePath(path: string, limit: number, cursor?: string | null) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return `${path}?${params.toString()}`;
}
const shelfPath = (id: string) => `/api/shelves/${encodeURIComponent(id)}`;
const planned = { planned: true } as const;

export const api = {
  getProfile: (signal?: AbortSignal) => request("/api/me", profileGuard, { signal }),
  createProfile: (displayName: string) => request("/api/me", profileGuard, { method: "POST", body: { display_name: displayName } }),
  listShelves: (cursor?: string | null, signal?: AbortSignal) => request(pagePath("/api/shelves", 30, cursor), pageGuard(shelfGuard), { ...planned, signal }),
  createShelf: (name: string) => request("/api/shelves", shelfDetailGuard, { ...planned, method: "POST", body: { name } }),
  joinShelf: (inviteCode: string) => request("/api/shelves/join", shelfGuard, { ...planned, method: "POST", body: { inviteCode } }),
  getShelf: (id: string, signal?: AbortSignal) => request(shelfPath(id), shelfDetailGuard, { ...planned, signal }),
  listBooks: (id: string, cursor?: string | null, signal?: AbortSignal) => request(pagePath(`${shelfPath(id)}/books`, 30, cursor), pageGuard(bookGuard), { ...planned, signal }),
  createBook: (id: string, input: { title: string; authors: string[] }) => request(`${shelfPath(id)}/books`, bookGuard, { ...planned, method: "POST", body: input }),
  listPosts: (id: string, cursor?: string | null, signal?: AbortSignal) => request(pagePath(`${shelfPath(id)}/posts`, 6, cursor), pageGuard(postGuard), { ...planned, signal }),
  listReading: (id: string, cursor?: string | null, signal?: AbortSignal) => request(pagePath(`${shelfPath(id)}/reading`, 30, cursor), pageGuard(recordGuard), { ...planned, signal }),
  createPost: (id: string, input: PostInput, idempotencyKey: string) => request(`${shelfPath(id)}/posts`, createPostGuard, { ...planned, method: "POST", body: input, idempotencyKey }),
};
