"use client";

import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import styles from "./mobile.module.css";
import { currentUserId, initialBooks, initialMembers, initialPosts, statusLabels, type Book, type Member, type ReadingPost, type ReadingStatus } from "./sample-data";

type Tab = "feed" | "write" | "books";
const count = (text: string) => Array.from(text).length;
const dateLabel = (date: string) => new Date(date).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" });
const timeLabel = (date: string) => new Date(date).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
function Icon({ name }: { name: Tab | "close" | "search" | "back" | "profile" }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "feed" ? <><rect x="4" y="3" width="16" height="7" rx="2" /><rect x="4" y="14" width="16" height="7" rx="2" /></> : name === "write" ? <path d="M12 5v14M5 12h14" /> : name === "books" ? <><path d="M3 4h7v16H3zM14 5l5-1 3 15-5 1zM6 8h1M6 16h1" /></> : name === "close" ? <path d="m6 6 12 12M6 18 18 6" /> : name === "search" ? <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></> : name === "back" ? <path d="m14 6-6 6 6 6" /> : <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>}
  </svg>;
}
function Avatar({ member, large = false }: { member: Member; large?: boolean }) {
  return <span className={`${styles.avatar} ${large ? styles.avatarLarge : ""}`} style={{ "--avatar": member.color } as CSSProperties} aria-hidden="true">{Array.from(member.displayName)[0]}</span>;
}
function Cover({ book, mini = false }: { book: Book; mini?: boolean }) {
  return <div className={`${styles.cover} ${styles[`cover${book.theme}`]} ${mini ? styles.mini : ""}`} aria-hidden="true"><span className={styles.coverMark}>綴</span><span className={styles.coverTitle}>{book.title}</span><span className={styles.coverAuthor}>{book.authors.join("・") || "著者未設定"}</span><i /></div>;
}
function PostCard({ post, book, member }: { post: ReadingPost; book: Book; member: Member }) {
  const [revealed, setRevealed] = useState(false);
  return <article className={`${styles.card} ${styles[`scene${book.theme}`]}`} aria-label={`${member.displayName}の読書記録 ${book.title}`}>
    <div className={styles.scenery} aria-hidden="true"><span className={styles.sunlight} /><span className={styles.table} /><span className={styles.cup} /><div className={styles.sceneBook}><Cover book={book} /></div></div>
    <header className={styles.cardTop}><span className={styles.person}><Avatar member={member} /><span>{member.displayName}{member.userId === currentUserId && <small>あなた</small>}</span></span><span className={styles.date}>{dateLabel(post.createdAt)}</span></header>
    <div className={styles.cardContent}><p className={styles.cardBook}>{book.title}<span>{book.authors.join("・") || "著者未設定"}</span></p><time dateTime={post.createdAt}>{timeLabel(post.createdAt)}</time><p className={styles.progress}><span className={styles.dot} />{statusLabels[post.status]}{post.currentPage !== null && <><span className={styles.divider}>/</span><strong>{post.currentPage}</strong> ページ</>}</p>
    {post.containsSpoiler && post.comment ? <><button className={styles.spoiler} aria-expanded={revealed} onClick={() => setRevealed(!revealed)}>{revealed ? "ひとことを隠す" : "ネタバレを含むひとことを見る"}<span aria-hidden="true">{revealed ? "−" : "+"}</span></button>{revealed && <p className={styles.comment}>{post.comment}</p>}</> : post.comment && <p className={styles.comment}>{post.comment}</p>}</div>
  </article>;
}

export default function MockRoom() {
  const [tab, setTab] = useState<Tab>("feed");
  const [books, setBooks] = useState(initialBooks);
  const [posts, setPosts] = useState(initialPosts);
  const [members, setMembers] = useState(initialMembers);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initialBooks[0].bookId);
  const [status, setStatus] = useState<ReadingStatus>("reading");
  const [page, setPage] = useState("120");
  const [comment, setComment] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [draftName, setDraftName] = useState(initialMembers[0].displayName);
  const [dialogError, setDialogError] = useState("");
  const addDialog = useRef<HTMLDialogElement>(null);
  const profileDialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const me = members.find(member => member.userId === currentUserId)!;
  const selectedBook = books.find(book => book.bookId === selected)!;
  const visiblePosts = posts.filter(post => filter === "all" || post.userId === filter).slice(0, 6);
  const normalized = query.trim().toLocaleLowerCase();
  const foundBooks = books.filter(book => `${book.title} ${book.authors.join(" ")}`.toLocaleLowerCase().includes(normalized));
  const finishedCount = new Set(posts.filter(post => post.userId === currentUserId && post.status === "finished").map(post => post.bookId)).size;
  function navigate(next: Tab) { setTab(next); setError(""); setNotice(""); window.scrollTo({ top: 0 }); requestAnimationFrame(() => heading.current?.focus({ preventScroll: true })); }
  function startWriting(bookId: string) {
    const latest = posts.find(post => post.bookId === bookId && post.userId === currentUserId);
    setSelected(bookId); setStatus(latest?.status ?? "reading"); setPage(latest?.currentPage?.toString() ?? ""); setComment(""); setSpoiler(false); navigate("write");
  }
  function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentPage = page.trim() === "" ? null : Number(page);
    if (currentPage !== null && (!Number.isInteger(currentPage) || currentPage < 0 || currentPage > 2147483647)) { setError("ページは0〜2147483647の整数で入力してください。"); return; }
    if (count(comment) > 200) { setError("ひとことは200文字以内で入力してください。"); return; }
    const newPost: ReadingPost = { postId: crypto.randomUUID(), bookId: selected, userId: currentUserId, status, currentPage, comment: comment.trim(), containsSpoiler: spoiler && comment.trim() !== "", createdAt: new Date().toISOString() };
    setPosts(previous => [newPost, ...previous]); setFilter("all"); setComment(""); setSpoiler(false); navigate("feed"); setNotice("見本に記録しました。再読み込みするとリセットされます。");
  }
  function addBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || count(title.trim()) > 200) { setDialogError("タイトルを1〜200文字で入力してください。"); return; }
    if (count(author.trim()) > 100) { setDialogError("著者名は100文字以内で入力してください。"); return; }
    const newBook: Book = { bookId: crypto.randomUUID(), title: title.trim(), authors: author.trim() ? [author.trim()] : [], addedBy: currentUserId, theme: books.length % 4 };
    setBooks(previous => [newBook, ...previous]); setTitle(""); setAuthor(""); setQuery(""); addDialog.current?.close(); setNotice("見本に本を追加しました。DBには保存されません。");
  }
  return <div className={styles.desktop}><aside className={styles.desktopNote} aria-hidden="true"><span className={styles.sideBrand}>綴り<span>tsuzuri</span></span><p>同じ時間に、<br />違うページを。</p><small>A LITTLE READING, EVERY DAY.</small></aside><div className={styles.phone}>
    <header className={styles.header}><a href="/mock" aria-label="綴り ホーム" className={styles.logo}>綴り<span>tsuzuri</span></a><div className={styles.room}>いつもの本棚<span><i />{members.length}人で読んでいます</span></div><button className={styles.profileButton} aria-label="プロフィールを開く" onClick={() => { setDraftName(me.displayName); setDialogError(""); profileDialog.current?.showModal(); }}><Avatar member={me} /></button></header>
    <div className={styles.demo}><span>DEMO</span>架空データの見本 · 再読み込みでリセット<a href="/">開発画面 ↗</a></div>
    <main>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {tab === "feed" && <section aria-label="みんなの読書記録"><div className={styles.feedHeading}><div><p className={styles.eyebrow}>READING TOGETHER</p><h1 ref={heading} tabIndex={-1}>みんなの、いま。</h1></div><span>最近の6件</span></div>
        <div className={styles.people} role="group" aria-label="投稿者で絞り込む"><button aria-pressed={filter === "all"} onClick={() => setFilter("all")}><span className={styles.everyone}><Icon name="feed" /></span><span>みんな</span></button>{members.map(member => <button key={member.userId} aria-pressed={filter === member.userId} onClick={() => setFilter(member.userId)}><Avatar member={member} large /><span>{member.userId === currentUserId ? "あなた" : member.displayName}</span></button>)}</div>
        <div className={styles.feed}>{visiblePosts.map(post => { const book = books.find(item => item.bookId === post.bookId); const member = members.find(item => item.userId === post.userId); return book && member ? <PostCard key={post.postId} post={post} book={book} member={member} /> : null; })}</div>
        {!visiblePosts.length && <div className={styles.empty}><Icon name="books" /><h2>まだ、最初のページ。</h2><p>読んだ本とひとことを残してみよう。</p><button onClick={() => startWriting(selected)}>読書を記録する</button></div>}
        <footer className={styles.feedEnd}><span>ここまでが、最近の記録。</span><p>これまでの本はライブラリに残ります。</p><button onClick={() => navigate("books")}>本を見にいく <span aria-hidden="true">↗</span></button></footer>
      </section>}
      {tab === "write" && <section className={styles.panel}><p className={styles.eyebrow}>YOUR READING MOMENT</p><h1 ref={heading} tabIndex={-1}>今日は、どこまで？</h1><p className={styles.help}>一ページでも、ひと休みでも。</p>
        <form onSubmit={submitPost} noValidate><div className={styles.selectedBook}><Cover book={selectedBook} mini /><label>記録する本<select value={selected} onChange={event => { const bookId = event.target.value; const latest = posts.find(post => post.bookId === bookId && post.userId === currentUserId); setSelected(bookId); setStatus(latest?.status ?? "reading"); setPage(latest?.currentPage?.toString() ?? ""); }}>{books.map(book => <option key={book.bookId} value={book.bookId}>{book.title}</option>)}</select><small>{selectedBook.authors.join("・") || "著者未設定"}</small></label></div>
          <fieldset className={styles.statusField}><legend>いまの状態</legend><div className={styles.statusOptions}>{(Object.keys(statusLabels) as ReadingStatus[]).map(value => <label key={value}><input type="radio" name="reading-status" value={value} checked={status === value} onChange={() => setStatus(value)} /><span>{statusLabels[value]}</span></label>)}</div></fieldset>
          <label className={styles.field}>現在のページ<span className={styles.optional}>任意</span><div className={styles.pageInput}><input aria-label="現在のページ" type="number" inputMode="numeric" min="0" max="2147483647" step="1" value={page} onChange={event => setPage(event.target.value)} placeholder="0" /><span>ページまで読んだ</span></div></label>
          <label className={styles.field}>ひとこと<span className={styles.optional}>任意</span><textarea rows={4} value={comment} onChange={event => setComment(event.target.value)} placeholder="あと一章だけ、のつもりだった。" aria-describedby="comment-count" /><small id="comment-count" className={count(comment) > 200 ? styles.invalid : ""}>{count(comment)} / 200</small></label>
          <label className={styles.spoilerOption}><span><strong>ネタバレを含む</strong><small>読む人がタップするまで、ひとことを隠します。</small></span><input type="checkbox" checked={spoiler} onChange={event => setSpoiler(event.target.checked)} /></label>
          {error && <p className={styles.error} role="alert">{error}</p>}<button type="submit" className={styles.primary}>この瞬間を記録する <span aria-hidden="true">↗</span></button><p className={styles.formNote}>見本への記録です。サーバーには保存されません。</p>
        </form></section>}
      {tab === "books" && <section className={styles.panel}><p className={styles.eyebrow}>OUR LIBRARY</p><div className={styles.libraryHeading}><h1 ref={heading} tabIndex={-1}>これまでの本。</h1><button className={styles.addButton} aria-label="本を追加" onClick={() => { setDialogError(""); addDialog.current?.showModal(); }}><Icon name="write" /></button></div><p className={styles.help}>みんなが出会った、{books.length}冊。</p><label className={styles.search}><Icon name="search" /><input aria-label="本を検索" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="タイトル・著者で探す" /></label><div className={styles.listCaption}><span>{query.trim() ? `${foundBooks.length}冊の検索結果` : "すべての本"}</span><span>本を選んで記録</span></div>
        <ul className={styles.books}>{foundBooks.map(book => { const member = members.find(item => item.userId === book.addedBy)!; const latest = posts.find(post => post.bookId === book.bookId && post.userId === currentUserId); const finished = posts.some(post => post.bookId === book.bookId && post.userId === currentUserId && post.status === "finished"); return <li key={book.bookId}><button onClick={() => startWriting(book.bookId)}><Cover book={book} mini /><span className={styles.bookInfo}><strong>{book.title}</strong><span>{book.authors.join("・") || "著者未設定"}</span><small>{member.displayName}が追加{latest ? ` · ${statusLabels[latest.status]}` : ""}</small>{finished && <small className={styles.finished}>あなたは読了済み ✓</small>}</span><span className={styles.chevron} aria-hidden="true">›</span></button></li>; })}</ul>
        {!foundBooks.length && <div className={styles.empty}><Icon name="search" /><h2>本が見つかりませんでした</h2><p>別のタイトルや著者名で探してみてください。</p><button onClick={() => setQuery("")}>検索をクリア</button></div>}</section>}
    </main>
    <nav className={styles.nav} aria-label="メインメニュー">{([{ id: "feed", label: "みんな" }, { id: "write", label: "記録する" }, { id: "books", label: "本" }] as const).map(item => <button key={item.id} aria-current={tab === item.id ? "page" : undefined} onClick={() => item.id === "write" ? navigate("write") : navigate(item.id)}><span className={item.id === "write" ? styles.recordIcon : ""}><Icon name={item.id} /></span><span>{item.label}</span></button>)}</nav>
    <dialog ref={addDialog} className={styles.dialog} aria-labelledby="add-title"><div className={styles.dialogTop}><span>ADD A BOOK</span><button aria-label="本の追加を閉じる" onClick={() => addDialog.current?.close()}><Icon name="close" /></button></div><h2 id="add-title">次の一冊を、本棚に。</h2><p className={styles.help}>表紙がなくても、タイトルだけで始められます。</p><form onSubmit={addBook} noValidate><label className={styles.field}>タイトル<input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="本のタイトル" /></label><label className={styles.field}>著者<span className={styles.optional}>任意</span><input value={author} onChange={event => setAuthor(event.target.value)} placeholder="著者名" /></label>{dialogError && <p className={styles.error} role="alert">{dialogError}</p>}<button className={styles.primary}>見本の本棚に追加する</button><p className={styles.formNote}>ISBN検索・表紙取得は今後の対応です。</p></form></dialog>
    <dialog ref={profileDialog} className={styles.dialog} aria-labelledby="profile-title"><div className={styles.dialogTop}><span>MY PROFILE</span><button aria-label="プロフィールを閉じる" onClick={() => profileDialog.current?.close()}><Icon name="close" /></button></div><div className={styles.profileIntro}><Avatar member={me} large /><h2 id="profile-title">{me.displayName}の読書時間</h2><p>{posts.filter(post => post.userId === currentUserId).length}回の記録 <span>·</span> {finishedCount}冊の読了</p></div><form onSubmit={event => { event.preventDefault(); if (!draftName.trim() || count(draftName.trim()) > 30) { setDialogError("表示名は1〜30文字で入力してください。"); return; } setMembers(previous => previous.map(member => member.userId === currentUserId ? { ...member, displayName: draftName.trim() } : member)); setDialogError(""); profileDialog.current?.close(); setNotice("見本の表示名を変更しました。再読み込みでリセットされます。"); }} noValidate><label className={styles.field}>表示名<input value={draftName} onChange={event => setDraftName(event.target.value)} autoComplete="off" /></label>{dialogError && <p className={styles.error} role="alert">{dialogError}</p>}<button className={styles.primary}>見本の表示名を保存</button></form><div className={styles.members}><h3>いつもの本棚のメンバー</h3>{members.map(member => <div key={member.userId}><Avatar member={member} /><span>{member.displayName}</span><small>{member.userId === currentUserId ? "あなた · オーナー" : "メンバー"}</small></div>)}</div><p className={styles.formNote}>架空のプロフィールです。登録・ログイン・招待はまだ接続していません。</p></dialog>
  </div></div>;
}
