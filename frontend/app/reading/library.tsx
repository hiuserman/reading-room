"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ApiError, type api, type Book, type Page, type Post, type PostInput, type Profile, type ReadingRecord, type ReadingStatus, type ShelfDetail } from "../../lib/reading-api";
import { login } from "../auth/session";
import s from "./reading.module.css";

type Props = { client: typeof api; profile: Profile; shelf: ShelfDetail; preview: boolean; onShelves: () => void; onAccount: () => void };
type Tab = "feed" | "write" | "books";
type Draft = { bookId: string; status: ReadingStatus; page: string; comment: string; spoiler: boolean; version: number };
type Attempt = { key: string; input: PostInput };
const blank: Draft = { bookId: "", status: "reading", page: "", comment: "", spoiler: false, version: 0 };
const labels: Record<ReadingStatus, string> = { reading: "読書中", paused: "サボり中", finished: "読了" };
const length = (value: string) => Array.from(value).length;
const message = (error: unknown) => error instanceof ApiError ? error.message : "通信を完了できませんでした。時間をおいてもう一度お試しください。";
const palette = ["#78614d", "#6d7d6a", "#646a83", "#986c56", "#9a875f"];
const color = (id: string) => palette[Array.from(id).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % palette.length];

function Icon({ name }: { name: Tab | "arrow" | "refresh" | "plus" }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "feed" ? <><rect x="4" y="3" width="16" height="7" rx="2" /><rect x="4" y="14" width="16" height="7" rx="2" /></> : name === "books" ? <><path d="M3 4h6v16H3zM12 5l6-1 3 15-6 1zM6 8v6" /></> : name === "arrow" ? <path d="m9 5 7 7-7 7" /> : name === "refresh" ? <><path d="M20 8A8 8 0 1 0 20 16M20 3v5h-5" /></> : <path d="M12 5v14M5 12h14" />}
  </svg>;
}

function Cover({ book, small = false }: { book: Pick<Book, "bookId" | "title" | "authors">; small?: boolean }) {
  return <div className={`${s.cover} ${small ? s.coverSmall : ""}`} style={{ "--book-color": color(book.bookId) } as CSSProperties} aria-hidden="true"><span className={s.coverMark}>綴</span><span className={s.coverTitle}>{book.title}</span><span className={s.coverAuthor}>{book.authors.join("・") || "ある日の一冊"}</span></div>;
}

function PostCard({ post, own }: { post: Post; own: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const date = new Date(post.createdAt);
  return <article className={s.postCard} style={{ "--scene-color": color(post.bookId) } as CSSProperties} aria-label={`${post.user.displayName}の読書記録`}>
    <div className={s.postScene} aria-hidden="true"><Cover book={post.book} /></div>
    <header className={s.postTop}><span className={s.person}><span className={s.avatar}>{Array.from(post.user.displayName)[0]}</span>{post.user.displayName}{own && <small>あなた</small>}</span><span className={s.date}>{date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</span></header>
    <div className={s.postBody}><p className={s.postBook}>{post.book.title}</p><p className={s.postAuthors}>{post.book.authors.join("・") || "著者未設定"}</p><time className={s.postTime} dateTime={post.createdAt}>{date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</time><p className={s.progress}><span className={s.statusDot} />{labels[post.status]}{post.currentPage !== null && <span> · {post.currentPage}ページ</span>}</p>
      {post.containsSpoiler && post.comment ? <><button className={s.spoilerButton} type="button" aria-expanded={revealed} onClick={() => setRevealed(!revealed)}>{revealed ? "ひとことを隠す −" : "ネタバレを含むひとこと ＋"}</button>{revealed && <p className={s.comment}>{post.comment}</p>}</> : post.comment && <p className={s.comment}>{post.comment}</p>}
    </div>
  </article>;
}

async function everyPage<T>(get: (cursor?: string | null) => Promise<Page<T>>): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    const result = await get(cursor);
    items.push(...result.items);
    if (result.nextCursor === null) return items;
    if (seen.has(result.nextCursor)) break;
    seen.add(result.nextCursor); cursor = result.nextCursor;
  }
  throw new ApiError(502, "PAGING_ERROR", "すべての本を読み込めませんでした。時間をおいて再読み込みしてください。");
}

function restore(value: string | null): { draft: Draft; attempt: Attempt | null } | null {
  try {
    if (!value) return null;
    const saved = JSON.parse(value);
    const d = saved.draft;
    if (!d || typeof d.bookId !== "string" || !Object.hasOwn(labels, d.status) || typeof d.page !== "string" || typeof d.comment !== "string" || typeof d.spoiler !== "boolean" || !Number.isSafeInteger(d.version) || d.version < 0) return null;
    const a = saved.attempt;
    if (a) {
      const i = a.input;
      if (typeof a.key !== "string" || !a.key || !i || typeof i.bookId !== "string" || !Object.hasOwn(labels, i.status) || typeof i.comment !== "string" || typeof i.containsSpoiler !== "boolean" || !Number.isSafeInteger(i.expectedVersion) || i.expectedVersion < 0 || !(i.currentPage === null || (Number.isInteger(i.currentPage) && i.currentPage >= 0 && i.currentPage <= 2147483647))) return null;
    }
    return { draft: d, attempt: a ?? null };
  } catch { return null; }
}

export default function Library({ client, profile, shelf, preview, onShelves, onAccount }: Props) {
  const [tab, setTab] = useState<Tab>("feed");
  const [books, setBooks] = useState<Book[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<Draft>(blank);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [posting, setPosting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [bookBusy, setBookBusy] = useState(false);
  const [bookUncertain, setBookUncertain] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);
  const postLock = useRef(false);
  const bookLock = useRef(false);
  const storageKey = `tsuzuri:draft:${profile.user_id}:${shelf.shelfId}`;

  useEffect(() => {
    mounted.current = true;
    if (!preview) {
      try { const saved = restore(sessionStorage.getItem(storageKey)); if (saved) { setDraft(saved.draft); setAttempt(saved.attempt); if (saved.attempt) { setTab("write"); setNotice("送信結果が未確認の記録があります。同じ内容で再確認できます。"); } } } catch { /* Storage can be unavailable. */ }
    }
    setDraftReady(true);
    return () => { mounted.current = false; request.current?.abort(); };
  }, [preview, storageKey]);

  useEffect(() => {
    if (!draftReady || preview) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ draft, attempt })); } catch { /* In-memory editing still works. */ }
  }, [attempt, draft, draftReady, preview, storageKey]);

  const load = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(""); setErrorStatus(0);
    try {
      const [allBooks, allReading, recent] = await Promise.all([
        everyPage(cursor => client.listBooks(shelf.shelfId, cursor, controller.signal)),
        everyPage(cursor => client.listReading(shelf.shelfId, cursor, controller.signal)),
        client.listPosts(shelf.shelfId, undefined, controller.signal),
      ]);
      if (!mounted.current || request.current !== controller || controller.signal.aborted) return;
      if (allBooks.some(book => book.shelfId !== shelf.shelfId) || allReading.some(record => record.shelfId !== shelf.shelfId || record.userId !== profile.user_id) || recent.items.some(post => post.shelfId !== shelf.shelfId)) throw new ApiError(502, "INVALID_RESPONSE", "本棚の情報を確認できませんでした。もう一度読み込んでください。");
      setBooks(Array.from(new Map(allBooks.map(book => [book.bookId, book])).values()));
      setRecords(allReading);
      setPosts(Array.from(new Map(recent.items.map(post => [post.postId, post])).values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6));
      setLoaded(true);
      setDraft(previous => {
        if (previous.bookId || !allBooks.length) return previous;
        const first = allBooks[0]; const record = allReading.find(value => value.bookId === first.bookId);
        return { ...previous, bookId: first.bookId, status: record?.status ?? "reading", page: record?.currentPage?.toString() ?? "", version: record?.version ?? 0 };
      });
    } catch (err) {
      if (!mounted.current || request.current !== controller || controller.signal.aborted) return;
      setError(message(err)); setErrorStatus(err instanceof ApiError ? err.status : 0);
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) { setBooks([]); setPosts([]); setRecords([]); setLoaded(false); }
    } finally { if (mounted.current && request.current === controller) { request.current = null; setLoading(false); } }
  }, [client, profile.user_id, shelf.shelfId]);
  useEffect(() => { void load(); return () => { request.current?.abort(); request.current = null; }; }, [load]);

  function navigate(next: Tab) { setTab(next); setNotice(""); window.scrollTo({ top: 0 }); requestAnimationFrame(() => heading.current?.focus({ preventScroll: true })); }
  function selectBook(id: string) {
    if (attempt || posting || conflict) return;
    const record = records.find(item => item.bookId === id);
    setDraft(previous => ({ ...previous, bookId: id, status: record?.status ?? "reading", page: record?.currentPage?.toString() ?? "", version: record?.version ?? 0 }));
  }
  function writeBook(id: string) { selectBook(id); navigate("write"); }
  function showError(err: unknown) { setError(message(err)); setErrorStatus(err instanceof ApiError ? err.status : 0); if (err instanceof ApiError && err.status === 403) { setBooks([]); setPosts([]); setRecords([]); setLoaded(false); } }

  async function submitPost(event?: FormEvent) {
    event?.preventDefault();
    if (postLock.current || conflict || !loaded) return;
    const currentPage = draft.page.trim() === "" ? null : Number(draft.page);
    if (!attempt && (!books.some(book => book.bookId === draft.bookId) || currentPage !== null && (!Number.isInteger(currentPage) || currentPage < 0 || currentPage > 2147483647) || length(draft.comment) > 200)) { setError("本を選び、ページは0以上の整数、ひとことは200文字以内で入力してください。"); return; }
    const sent = attempt ?? { key: crypto.randomUUID(), input: { bookId: draft.bookId, status: draft.status, currentPage, comment: draft.comment.trim(), containsSpoiler: draft.spoiler && draft.comment.trim() !== "", expectedVersion: draft.version } };
    postLock.current = true; setPosting(true); setAttempt(sent); setError(""); setErrorStatus(0);
    // Persist before the network request; a navigation can happen before React's effect.
    if (!preview) { try { sessionStorage.setItem(storageKey, JSON.stringify({ draft, attempt: sent })); } catch { /* Optional draft storage. */ } }
    try {
      const result = await client.createPost(shelf.shelfId, sent.input, sent.key);
      if (!mounted.current) return;
      setPosts(previous => [result.post, ...previous.filter(post => post.postId !== result.post.postId)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6));
      setRecords(previous => [...previous.filter(record => record.bookId !== result.readingRecord.bookId), result.readingRecord]);
      setDraft(previous => ({ ...previous, comment: "", spoiler: false, version: result.readingRecord.version }));
      setAttempt(null); navigate("feed"); setNotice(preview ? "見本に記録しました。再読み込みでリセットされます。" : "今日の一ページを、記録しました。");
    } catch (err) {
      if (!mounted.current) return;
      showError(err);
      if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
        if (err.status === 409) { setConflict(true); }
        // A rejected request has no uncertain commit. Input is retained for correction.
        setAttempt(null);
      }
    } finally { postLock.current = false; if (mounted.current) setPosting(false); }
  }

  async function confirmLatest() {
    if (postLock.current) return;
    postLock.current = true; setPosting(true);
    try {
      const latest = await everyPage(cursor => client.listReading(shelf.shelfId, cursor));
      if (!mounted.current) return;
      const record = latest.find(value => value.bookId === draft.bookId && value.userId === profile.user_id);
      setRecords(latest); setDraft(previous => ({ ...previous, version: record?.version ?? 0 }));
      setConflict(false); setError(""); setErrorStatus(0); setNotice(`最新の記録は${record ? `${labels[record.status]}・${record.currentPage === null ? "ページ未設定" : `${record.currentPage}ページ`}` : "未記録"}です。入力内容を確認して、あらためて記録してください。`);
    } catch (err) { if (mounted.current) showError(err); }
    finally { postLock.current = false; if (mounted.current) setPosting(false); }
  }

  async function addBook(event: FormEvent) {
    event.preventDefault(); if (bookLock.current || bookUncertain) return;
    const title = bookTitle.trim(); const names = authors.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    if (!title || length(title) > 200 || names.length > 10 || names.some(name => length(name) > 100)) { setError("タイトルは1〜200文字、著者は1人100文字以内・10人までで入力してください。"); return; }
    bookLock.current = true; setBookBusy(true); setError(""); setErrorStatus(0);
    try {
      const book = await client.createBook(shelf.shelfId, { title, authors: names });
      if (!mounted.current) return;
      setBooks(previous => [book, ...previous.filter(item => item.bookId !== book.bookId)]); setAdding(false); setBookTitle(""); setAuthors(""); setQuery(""); selectBook(book.bookId);
      setNotice(preview ? "見本の本棚に追加しました。再読み込みでリセットされます。" : "新しい一冊を、本棚に追加しました。");
    } catch (err) {
      if (!mounted.current) return;
      showError(err); if (!(err instanceof ApiError) || err.status === 0 || err.status >= 500 || err.status === 408) setBookUncertain(true);
    } finally { bookLock.current = false; if (mounted.current) setBookBusy(false); }
  }

  const filtered = books.filter(book => `${book.title} ${book.authors.join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selected = books.find(book => book.bookId === draft.bookId);
  const unavailable = !loaded || errorStatus === 401 || errorStatus === 403;
  const locked = posting || !!attempt || conflict;
  const titles = { feed: "みんなの、いま。", write: "今日は、どこまで？", books: adding ? "次の一冊を、本棚に。" : "これまでの本。" };

  return <><main className={s.main}>
    <div className={s.sectionHeading}><div><p className={s.eyebrow}>{tab === "feed" ? "READING TOGETHER" : tab === "write" ? "YOUR READING MOMENT" : "OUR LIBRARY"}</p><h1 className={s.title} ref={heading} tabIndex={-1}>{titles[tab]}</h1></div>{tab === "feed" && <button className={s.iconButton} aria-label="記録を再読み込み" disabled={loading || posting || bookBusy} onClick={() => void load()}><Icon name="refresh" /></button>}</div>
    {notice && <p className={s.notice} role="status">{notice}</p>}
    {error && <div className={s.error} role="alert"><p>{error}</p>{errorStatus === 401 ? <button className={s.secondary} onClick={() => void login().catch(showError)}>ログインし直す</button> : errorStatus === 403 ? <button className={s.secondary} onClick={onShelves}>本棚を選び直す</button> : !loaded && <button className={s.secondary} disabled={loading} onClick={() => void load()}>もう一度読み込む</button>}</div>}
    {loading && <p className={s.loading} role="status">本棚を読み込んでいます…</p>}
    {!unavailable && tab === "feed" && <>
      <p className={s.subtitle}>読んだ日も、ひと休みの日も。<span className={s.badge}>最近の6件</span></p>
      <div className={s.feed}>{posts.map(post => <PostCard key={post.postId} post={post} own={post.userId === profile.user_id} />)}</div>
      {!posts.length && <div className={s.empty}><span className={s.emptyIcon}><Icon name="books" /></span><h2>まだ、最初のページ。</h2><p>今日の一冊と、ひとことを残してみませんか。</p><button className={s.primary} onClick={() => books.length ? navigate("write") : (setAdding(true), navigate("books"))}>{books.length ? "最初の記録を残す" : "最初の一冊を追加する"}</button></div>}
      {!!posts.length && <footer className={s.footer}><p>ここまでが、最近の記録。</p><small>これまでの本は、ライブラリに残ります。</small><button className={s.textButton} onClick={() => navigate("books")}>本を見にいく ↗</button></footer>}
    </>}
    {!unavailable && tab === "write" && <section className={s.compose}>
      <p className={s.subtitle}>一ページでも、ひと休みでも。</p>
      {!books.length ? <div className={s.empty}><Icon name="books" /><h2>まずは、一冊。</h2><p>記録したい本を、本棚に追加しましょう。</p><button className={s.primary} onClick={() => { setAdding(true); navigate("books"); }}>本を追加する</button></div> : <form className={s.form} onSubmit={submitPost} noValidate>
        <div className={s.selectedBook}>{selected && <Cover book={selected} small />}<label className={s.field}>記録する本<select value={draft.bookId} disabled={locked} onChange={event => selectBook(event.target.value)}>{!selected && <option value="">本を選んでください</option>}{books.map(book => <option value={book.bookId} key={book.bookId}>{book.title}</option>)}</select><span className={s.hint}>{selected?.authors.join("・") || "著者未設定"}</span></label></div>
        <fieldset className={s.field} disabled={locked}><legend>いまの状態</legend><div className={s.statusOptions}>{(Object.keys(labels) as ReadingStatus[]).map(value => <label className={`${s.statusOption} ${draft.status === value ? s.statusSelected : ""}`} key={value}><input type="radio" name="reading-status" value={value} checked={draft.status === value} onChange={() => setDraft(previous => ({ ...previous, status: value }))} />{labels[value]}</label>)}</div></fieldset>
        <label className={s.field}>現在のページ <small>任意</small><input type="number" inputMode="numeric" min="0" max="2147483647" step="1" value={draft.page} disabled={locked} onChange={event => setDraft(previous => ({ ...previous, page: event.target.value }))} placeholder="例：120" /><span className={s.hint}>空欄のままでも記録できます。</span></label>
        <label className={s.field}>ひとこと <small>任意</small><textarea rows={4} value={draft.comment} disabled={locked} onChange={event => setDraft(previous => ({ ...previous, comment: event.target.value }))} placeholder="あと一章だけ、のつもりだった。" aria-describedby="comment-count" /><span id="comment-count" className={s.characterCount}>{length(draft.comment)} / 200文字</span></label>
        <label className={s.checkbox}><input type="checkbox" checked={draft.spoiler} disabled={locked} onChange={event => setDraft(previous => ({ ...previous, spoiler: event.target.checked }))} /><span>ネタバレを含む<small>ひとことは、開くまで表示しません。</small></span></label>
        {attempt && !posting && <p className={s.hint}>保存結果が未確認です。同じ内容で再送して確認します。二重の記録にはしません。</p>}
        {conflict ? <><p className={s.hint}>別の画面で記録が更新された可能性があります。入力は保持しています。</p><button className={s.secondary} type="button" disabled={posting} onClick={() => void confirmLatest()}>最新の状態を確認する</button></> : <button className={s.primary} type="submit" disabled={posting || !selected}>{posting ? "記録しています…" : attempt ? "同じ内容で保存結果を確認" : preview ? "見本に記録する ↗" : "この瞬間を記録する ↗"}</button>}
        <p className={s.hint}>{preview ? "見本だけの記録です。再読み込みするとリセットされます。" : "投稿時刻は自動で記録されます。"}</p>
      </form>}
    </section>}
    {!unavailable && tab === "books" && <section className={s.library}>
      {adding ? <><button className={s.backButton} disabled={bookBusy} onClick={() => setAdding(false)}>← 本の一覧へ</button><p className={s.subtitle}>表紙がなくても、タイトルからはじめよう。</p><form className={s.form} onSubmit={addBook} noValidate>
        <label className={s.field}>タイトル<input autoFocus value={bookTitle} disabled={bookBusy || bookUncertain} onChange={event => setBookTitle(event.target.value)} placeholder="本のタイトル" required /></label>
        <label className={s.field}>著者 <small>任意</small><textarea rows={2} value={authors} disabled={bookBusy || bookUncertain} onChange={event => setAuthors(event.target.value)} placeholder="著者名" /><span className={s.hint}>複数いる場合は、1行に1人ずつ。</span></label>
        {bookUncertain ? <div className={s.panel}><p>保存されている可能性があります。一覧を更新して確認してから、追加し直してください。</p><button className={s.secondary} type="button" disabled={loading} onClick={() => { void load(); setAdding(false); }}>本の一覧を更新する</button><button className={s.textButton} type="button" onClick={() => { setBookUncertain(false); setError(""); }}>一覧を確認しました。入力に戻る</button></div> : <button type="submit" className={s.primary} disabled={bookBusy}>{bookBusy ? "追加しています…" : preview ? "見本の本棚に追加する" : "本棚に追加する"}</button>}
      </form></> : <><div className={s.sectionHeading}><p className={s.subtitle}>みんなが出会った、{books.length}冊。</p><button className={s.secondary} onClick={() => { setError(""); setAdding(true); }}>＋ 本を追加</button></div><label className={s.search}><span className={s.visuallyHidden}>タイトル・著者で検索</span><input type="search" className={s.searchInput} placeholder="タイトル・著者で探す" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <p className={s.hint}>{query.trim() ? `${filtered.length}冊の検索結果` : "すべての本"} · 本を選んで記録</p>
        <div>{filtered.map(book => { const record = records.find(item => item.bookId === book.bookId); const member = shelf.members.find(item => item.userId === book.addedBy); return <button className={s.bookRow} key={book.bookId} onClick={() => writeBook(book.bookId)}><Cover book={book} small /><span className={s.bookInfo}><strong className={s.bookTitle}>{book.title}</strong><span className={s.bookMeta}>{book.authors.join("・") || "著者未設定"}</span><span className={s.bookMeta}>{book.addedBy === profile.user_id ? "あなた" : member?.displayName ?? "メンバー"}が追加{record ? ` · ${labels[record.status]}` : ""}</span>{record?.finishedAt && <span className={s.bookStatus}>✓ あなたは読了済み</span>}</span><Icon name="arrow" /></button>; })}</div>
        {!filtered.length && <div className={s.empty}><Icon name="books" /><h2>{books.length ? "本が見つかりませんでした" : "これから増える、好きな本。"}</h2><p>{books.length ? "別のタイトルや著者で探してみてください。" : "最初の一冊を、ここに置いてみよう。"}</p><button className={s.secondary} onClick={() => books.length ? setQuery("") : setAdding(true)}>{books.length ? "検索をクリア" : "本を追加する"}</button></div>}
      </>}
    </section>}
    <div className={s.buttonRow}><button className={s.textButton} onClick={onShelves}>本棚を選ぶ</button><button className={s.textButton} onClick={onAccount}>プロフィール</button></div>
  </main><nav className={s.tabs} aria-label="メインメニュー">{([{ id: "feed", label: "みんな" }, { id: "write", label: "記録する" }, { id: "books", label: "本" }] as const).map(item => <button key={item.id} className={`${s.navButton} ${tab === item.id ? s.navActive : ""}`} aria-current={tab === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><span className={s.navIcon}><Icon name={item.id} /></span><span>{item.label}</span></button>)}</nav></>;
}
