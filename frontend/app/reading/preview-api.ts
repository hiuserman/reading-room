// Explicit, in-memory preview. Never selected after a real API failure.
import { ApiError, type api, type Book, type Post, type Profile, type ReadingRecord, type ShelfDetail } from "../../lib/reading-api";
import { currentUserId, initialBooks, initialMembers, initialPosts } from "../mock/sample-data";

export const previewProfile: Profile = { user_id: currentUserId, display_name: "はる", created_at: "2026-11-22T00:00:00Z" };

export function createPreviewApi(): typeof api {
  let profile = { ...previewProfile };
  const shelves: ShelfDetail[] = [{ shelfId: "sample-room", name: "いつもの本棚", members: initialMembers.map(({ userId, displayName }) => ({ userId, displayName })), inviteCode: "TSUZURI" }];
  const books: Book[] = initialBooks.map(book => ({ ...book, shelfId: "sample-room", coverUrl: null, createdAt: "2026-11-22T00:00:00Z" }));
  const posts: Post[] = initialPosts.map(post => ({ ...post, shelfId: "sample-room", book: books.find(book => book.bookId === post.bookId)!, user: initialMembers.find(member => member.userId === post.userId)! }));
  const records: ReadingRecord[] = posts.map(post => ({ shelfId: post.shelfId, bookId: post.bookId, userId: post.userId, status: post.status, currentPage: post.currentPage, updatedAt: post.createdAt, finishedAt: post.status === "finished" ? post.createdAt : null, version: 1 }));
  const attempts = new Map<string, { body: string; result: { post: Post; readingRecord: ReadingRecord } }>();
  const page = <T,>(items: T[]) => ({ items, nextCursor: null });
  return {
    getProfile: async () => ({ ...profile }),
    createProfile: async name => { profile = { ...profile, display_name: name }; return profile; },
    listShelves: async () => page(shelves.map(({ shelfId, name }) => ({ shelfId, name }))),
    createShelf: async name => {
      const shelf: ShelfDetail = { shelfId: crypto.randomUUID(), name, members: [{ userId: profile.user_id, displayName: profile.display_name }], inviteCode: crypto.randomUUID().slice(0, 8).toUpperCase() };
      shelves.push(shelf); return shelf;
    },
    joinShelf: async code => {
      const shelf = shelves.find(item => item.inviteCode === code.trim());
      if (!shelf) throw new ApiError(404, "INVITE_NOT_FOUND", "招待コードが見つかりません。見本では TSUZURI を使えます。");
      return shelf;
    },
    getShelf: async id => { const shelf = shelves.find(item => item.shelfId === id); if (!shelf) throw new ApiError(404, "NOT_FOUND", "本棚が見つかりません。"); return shelf; },
    listBooks: async id => page(books.filter(book => book.shelfId === id)),
    createBook: async (id, input) => {
      const book: Book = { ...input, shelfId: id, bookId: crypto.randomUUID(), addedBy: profile.user_id, coverUrl: null, createdAt: new Date().toISOString() };
      books.unshift(book); return book;
    },
    listPosts: async id => page(posts.filter(post => post.shelfId === id).slice(0, 6)),
    listReading: async id => page(records.filter(record => record.shelfId === id && record.userId === profile.user_id)),
    createPost: async (id, input, key) => {
      const scope = `${id}:${profile.user_id}:${key}`;
      const old = attempts.get(scope);
      if (old) {
        if (old.body !== JSON.stringify(input)) throw new ApiError(409, "CONFLICT", "この送信は内容が変わっています。");
        return old.result;
      }
      const book = books.find(item => item.shelfId === id && item.bookId === input.bookId);
      if (!book) throw new ApiError(404, "NOT_FOUND", "本が見つかりません。");
      const index = records.findIndex(item => item.shelfId === id && item.bookId === input.bookId && item.userId === profile.user_id);
      const previous = records[index];
      if ((previous?.version ?? 0) !== input.expectedVersion) throw new ApiError(409, "CONFLICT", "読書記録が更新されています。最新の状態を確認してください。");
      const now = new Date().toISOString();
      const { expectedVersion, ...values } = input;
      const post: Post = { ...values, shelfId: id, postId: crypto.randomUUID(), userId: profile.user_id, createdAt: now, book, user: { userId: profile.user_id, displayName: profile.display_name } };
      const readingRecord: ReadingRecord = { shelfId: id, userId: profile.user_id, bookId: book.bookId, status: input.status, currentPage: input.currentPage, version: expectedVersion + 1, updatedAt: now, finishedAt: input.status === "finished" ? now : previous?.finishedAt ?? null };
      posts.unshift(post);
      if (index < 0) records.push(readingRecord); else records[index] = readingRecord;
      const result = { post, readingRecord };
      attempts.set(scope, { body: JSON.stringify(input), result }); return result;
    },
  };
}
