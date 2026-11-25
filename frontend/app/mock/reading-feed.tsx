"use client";

import { useState } from "react";
import styles from "./feed.module.css";

type Book = { id: number; title: string; author: string; color: string };
type Status = "reading" | "paused" | "finished";
type Post = { id: number; book: Book; person: string; status: Status; page: number | null; text: string; spoiler: boolean; time: string };
const labels: Record<Status, string> = { reading: "読書中", paused: "サボり中", finished: "読了" };

export default function ReadingFeed({ books, selected, onUpdate }: {
  books: Book[]; selected: Book;
  onUpdate: (bookId: number, status: Status) => void;
}) {
  const [posts, setPosts] = useState<Post[]>([
    { id: 3, book: books[0], person: "あなた", status: "reading", page: 120, text: "寝る前に少しだけ。気づいたら、もう一章。", spoiler: false, time: "21:30" },
    { id: 2, book: books[1], person: "あおい", status: "paused", page: 48, text: "今日はお休み。栞はここに置いたまま。", spoiler: false, time: "20:10" },
    { id: 1, book: books[2], person: "りく", status: "finished", page: 216, text: "最後の手紙が、最初の場面につながっていた。もう一度読み返したい。", spoiler: true, time: "18:45" },
  ]);
  const [status, setStatus] = useState<Status>("reading");
  const [page, setPage] = useState("");
  const [text, setText] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  return <section className={styles.section} aria-labelledby="feed-title">
    <div className={styles.heading}><div><p>READING MOMENTS</p><h2 id="feed-title">今日の、栞。</h2><span>読み進めた日も、ひと休みの日も。</span></div><a href="#reading-entry">ひとことを残す ↓</a></div>
    <p className={styles.demo}>操作できる見本 · 架空の本とメンバーです。DBには保存されず、再読み込みでリセットされます。</p>
    <div className={styles.layout}>
      <div className={styles.feed} aria-label="みんなの読書投稿・新しい順">
        {posts.slice(0, 6).map(post => <article key={post.id} className={styles.card} style={{ backgroundColor: post.book.color }}>
          <div className={styles.cardTop}><span>{post.person}</span><span>{labels[post.status]}</span></div>
          <div className={styles.book}><small>綴り文庫 · SAMPLE COVER</small><h3>{post.book.title}</h3><span>{post.book.author}</span></div>
          <div className={styles.moment}><time>{post.time}</time><p>{post.page === null ? "ページ未設定" : `${post.page}ページまで`} <span>／ {labels[post.status]}</span></p>
            {post.spoiler ? <><button type="button" aria-expanded={revealed.includes(post.id)} onClick={() => setRevealed(revealed.includes(post.id) ? revealed.filter(id => id !== post.id) : [...revealed, post.id])}>{revealed.includes(post.id) ? "ネタバレを隠す" : "ネタバレあり · ひとことを表示"}</button>{revealed.includes(post.id) && <p className={styles.comment}>{post.text}</p>}</> : post.text && <p className={styles.comment}>{post.text}</p>}
          </div>
        </article>)}
        <p className={styles.caption}>直近6件を表示。本は下の全冊ライブラリに残ります。</p>
      </div>
      <form id="reading-entry" className={styles.form} onSubmit={event => {
        event.preventDefault();
        const currentPage = page.trim() === "" ? null : Number(page);
        if (currentPage !== null && (!Number.isSafeInteger(currentPage) || currentPage < 0)) { setError("ページは0以上の整数で入力してください。"); return; }
        setError("");
        const id = Math.max(...posts.map(post => post.id)) + 1;
        setPosts([{ id, book: { ...selected }, person: "あなた", status, page: currentPage, text: text.trim(), spoiler: spoiler && text.trim().length > 0, time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) }, ...posts]);
        onUpdate(selected.id, status);
        setNotice(`「${selected.title}」の記録を見本に追加しました。DBには保存していません。`);
        setText(""); setSpoiler(false);
      }}>
        <p className={styles.kicker}>MY READING NOTE</p><h3>今、どこまで読んだ？</h3>
        <div className={styles.selected}><small>選択中の本</small><strong>{selected.title}</strong><span>{selected.author}</span></div>
        <p className={styles.hint}>本を変えるときは、下の本棚・ライブラリから選んでください。</p>
        <label>いまの状態<select value={status} onChange={e => setStatus(e.target.value as Status)}><option value="reading">読書中</option><option value="paused">サボり中</option><option value="finished">読了</option></select></label>
        <label>現在ページ（任意）<input type="number" min="0" step="1" value={page} onChange={e => setPage(e.target.value)} placeholder="例：120" /></label>
        <label>ひとこと（任意・200文字まで）<textarea maxLength={200} rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="今日の一冊に、短い感想を。" /></label>
        <label className={styles.checkbox}><input type="checkbox" checked={spoiler} onChange={e => setSpoiler(e.target.checked)} />ネタバレを含むので、最初は隠す</label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className={styles.submit}>見本に記録する ↗</button>
        <p role="status" className={styles.hint}>{notice || "時刻は投稿時刻です。読書時間の計測・返信機能はありません。"}</p>
      </form>
    </div>
  </section>;
}
