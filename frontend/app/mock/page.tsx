"use client";
import { useState } from "react";
import styles from "./mobile.module.css";
type Status = "reading" | "paused" | "finished";
type Book = { id: number; title: string; author: string; owner: string; theme: number };
type Post = { id: number; bookId: number; person: string; status: Status; page: number | null; comment: string; spoiler: boolean; time: string };
const labels: Record<Status, string> = { reading: "読書中", paused: "サボり中", finished: "読了" };
const seedBooks: Book[] = [
 { id: 1, title: "夜の余白", author: "遠野 灯", owner: "あなた", theme: 0 },
 { id: 2, title: "喫茶と雨の日", author: "小川 こよみ", owner: "あおい", theme: 1 },
 { id: 3, title: "植物のとなり", author: "森野 葉", owner: "りく", theme: 2 },
 { id: 4, title: "遠回りの地図", author: "岸 つむぎ", owner: "あなた", theme: 3 },
 { id: 5, title: "月曜日のスープ", author: "井上 なぎ", owner: "あおい", theme: 1 },
 { id: 6, title: "海辺の手紙", author: "青井 航", owner: "りく", theme: 0 },
];
const seedPosts: Post[] = [
 { id: 3, bookId: 1, person: "あなた", status: "reading", page: 120, comment: "あと一章だけ、のつもりだった。", spoiler: false, time: "21:30" },
 { id: 2, bookId: 2, person: "あおい", status: "paused", page: 48, comment: "今日はひと休み。続きは明日の自分へ。", spoiler: false, time: "20:10" },
 { id: 1, bookId: 3, person: "りく", status: "finished", page: 216, comment: "最後の手紙が、最初の場面につながっていた。", spoiler: true, time: "18:45" },
];
function NavIcon({ kind }: { kind: "feed" | "write" | "books" }) {
 return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{kind === "feed" ? <><rect x="4" y="3" width="16" height="7" rx="2" /><rect x="4" y="14" width="16" height="7" rx="2" /></> : kind === "write" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M7 12h10" /></> : <><path d="M3 4h7v16H3zM14 5l5-1 3 15-5 1zM6 8h1M6 16h1" /></>}</svg>;
}
export default function MockRoom() {
 const [tab, setTab] = useState<"feed" | "write" | "books">("feed");
 const [books, setBooks] = useState(seedBooks);
 const [posts, setPosts] = useState(seedPosts);
 const [person, setPerson] = useState("みんな");
 const [selected, setSelected] = useState(1);
 const [status, setStatus] = useState<Status>("reading");
 const [page, setPage] = useState("");
 const [comment, setComment] = useState("");
 const [spoiler, setSpoiler] = useState(false);
 const [open, setOpen] = useState<number[]>([]);
 const [query, setQuery] = useState("");
 const [notice, setNotice] = useState("");
 const [error, setError] = useState("");
 const [adding, setAdding] = useState(false);
 const [title, setTitle] = useState("");
 const [author, setAuthor] = useState("");
 const visiblePosts = posts.filter(post => person === "みんな" || post.person === person).slice(0, 6);
 const foundBooks = books.filter(book => (book.title + " " + book.author).includes(query.trim()));
 function navigate(next: typeof tab) { setTab(next); setError(""); window.scrollTo({ top: 0 }); }
 return <div className={styles.desktop}><div className={styles.phone}>
 <header className={styles.header}><a href="/mock" aria-label="綴り ホーム">綴り<span>つづり</span></a><span className={styles.room}>いつもの本棚 <span>3人</span></span><a href="/" className={styles.devLink}>開発</a></header>
 <div className={styles.demo}>操作できる見本 · 架空データ / 再読込でリセット</div>
 <main>
 {notice && <p className={styles.notice} role="status">{notice}</p>}
 {tab === "feed" && <section aria-label="みんなの近況">
 <div className={styles.day}><div><small>READING DAYS</small><h1>きょう、どこまで？</h1></div><span>最近の記録</span></div>
 <div className={styles.people} role="group" aria-label="投稿者で絞り込む">{["みんな", "あなた", "あおい", "りく"].map(name => <button key={name} aria-pressed={person === name} onClick={() => setPerson(name)}>{name}</button>)}</div>
 <div className={styles.feed}>{visiblePosts.map(post => { const book = books.find(item => item.id === post.bookId)!;
 return <article key={post.id} className={styles.card + " " + styles["theme" + book.theme]}>
 <div className={styles.art} aria-hidden="true"><div /><i /><b /></div>
 <div className={styles.cardTop}><span><i>{post.person.slice(0, 1)}</i>{post.person}</span><span>{labels[post.status]}</span></div>
 <div className={styles.cardBody}><p className={styles.bookTitle}>{book.title}<small>{book.author}</small></p><time>{post.time}</time><p className={styles.progress}>{post.page === null ? "ページ未設定" : post.page + "ページまで"}<span> · {labels[post.status]}</span></p>
 {post.spoiler ? <><button className={styles.spoiler} aria-expanded={open.includes(post.id)} onClick={() => setOpen(open.includes(post.id) ? open.filter(id => id !== post.id) : [...open, post.id])}>{open.includes(post.id) ? "ひとことを隠す" : "ネタバレあり · タップで読む"}</button>{open.includes(post.id) && <p className={styles.comment}>{post.comment}</p>}</> : post.comment && <p className={styles.comment}>{post.comment}</p>}
 </div></article>; })}</div>
 {visiblePosts.length === 0 && <p className={styles.empty}>まだ記録がありません。</p>}
 <p className={styles.end}>直近6件まで。読み終えた本は「本」に残ります。</p><button className={styles.inlineWrite} onClick={() => navigate("write")}>今日のひとことを残す ＋</button>
 </section>}
 {tab === "write" && <section className={styles.panel}><p className={styles.eyebrow}>MY READING</p><h1>栞を、ここに。</h1><p className={styles.help}>読んだ日も、サボった日も。短い記録をひとつ。</p>
 <form onSubmit={event => {
 event.preventDefault(); const value = page.trim() === "" ? null : Number(page);
 if (value !== null && (!Number.isSafeInteger(value) || value < 0)) { setError("ページは0以上の整数にしてください。"); return; }
 const post: Post = { id: Math.max(0, ...posts.map(p => p.id)) + 1, bookId: selected, person: "あなた", status, page: value, comment: comment.trim(), spoiler: spoiler && comment.trim() !== "", time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) };
 setPosts([post, ...posts]); setComment(""); setPage(""); setSpoiler(false); setPerson("みんな"); setNotice("見本に記録しました。DBには保存されません。"); navigate("feed");
 }}>
 <label>本<select value={selected} onChange={e => setSelected(Number(e.target.value))}>{books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>
 <label>いまの状態<select value={status} onChange={e => setStatus(e.target.value as Status)}>{Object.entries(labels).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
 <label>現在ページ（任意）<input type="number" min="0" step="1" value={page} onChange={e => setPage(e.target.value)} placeholder="例：120" /></label>
 <label>ひとこと（任意）<textarea rows={4} maxLength={200} value={comment} onChange={e => setComment(e.target.value)} placeholder="今日の一冊に、ひとこと。" /><small>{comment.length} / 200</small></label>
 <label className={styles.check}><input type="checkbox" checked={spoiler} onChange={e => setSpoiler(e.target.checked)} />ネタバレを含むので、最初は隠す</label>
 {error && <p role="alert">{error}</p>}<button className={styles.primary} type="submit">記録する</button></form></section>}
 {tab === "books" && <section className={styles.panel}><p className={styles.eyebrow}>OUR LIBRARY</p><div className={styles.libraryTitle}><h1>これまでの本。</h1><button onClick={() => setAdding(!adding)} aria-expanded={adding}>{adding ? "閉じる" : "＋ 追加"}</button></div><p className={styles.help}>みんなの一冊を、ずっとここに。{books.length}冊</p>
 {adding && <form className={styles.add} onSubmit={e => { e.preventDefault(); if (!title.trim()) return; const id = Math.max(...books.map(b => b.id)) + 1; setBooks([{ id, title: title.trim(), author: author.trim() || "著者未設定", owner: "あなた", theme: id % 4 }, ...books]); setTitle(""); setAuthor(""); setAdding(false); setNotice("見本の本を追加しました。DBには保存されません。"); }}>
 <label>タイトル<input required maxLength={100} value={title} onChange={e => setTitle(e.target.value)} /></label><label>著者<input maxLength={100} value={author} onChange={e => setAuthor(e.target.value)} /></label><button className={styles.primary} type="submit">見本に本を追加</button></form>}
 <label className={styles.search}>本を探す<input value={query} onChange={e => setQuery(e.target.value)} placeholder="タイトル・著者" /></label>
 <ul className={styles.books}>{foundBooks.map(book => <li key={book.id}><button onClick={() => { setSelected(book.id); navigate("write"); }}><span className={styles.miniCover + " " + styles["theme" + book.theme]} aria-hidden="true">{book.title.slice(0, 1)}</span><span><strong>{book.title}</strong><small>{book.author}</small><small>{book.owner}が追加{posts.some(p => p.bookId === book.id && p.person === "あなた" && p.status === "finished") ? " · あなたは読了済み" : ""}</small></span><span aria-hidden="true">›</span></button></li>)}</ul>
 {foundBooks.length === 0 && <p className={styles.empty}>該当する本はありません。</p>}</section>}
 </main>
 <nav className={styles.nav} aria-label="メインメニュー">{([{ id: "feed", label: "みんな" }, { id: "write", label: "記録する" }, { id: "books", label: "本" }] as const).map(item => <button key={item.id} aria-current={tab === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><NavIcon kind={item.id} /><span>{item.label}</span></button>)}</nav>
 </div></div>;
}
