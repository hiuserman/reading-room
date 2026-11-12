"use client";

import { useState } from "react";
import styles from "./room.module.css";

type Book = { id: number; title: string; author: string; color: string; owner: number; subtitle: string };
const people = ["あなた", "あおい", "りく"];
const initialBooks: Book[] = [
  { id: 1, title: "夜の余白", author: "遠野 灯", color: "#344e66", owner: 0, subtitle: "夜が静かになるころに。" },
  { id: 2, title: "喫茶と雨の日", author: "小川 こよみ", color: "#b86c4b", owner: 1, subtitle: "いつもの席で、もう一杯。" },
  { id: 3, title: "植物のとなり", author: "森野 葉", color: "#73856b", owner: 2, subtitle: "ゆっくり育つものについて。" },
  { id: 4, title: "遠回りの地図", author: "岸 つむぎ", color: "#c1a364", owner: 0, subtitle: "知らない道を、歩いてみる。" },
  { id: 5, title: "月曜日のスープ", author: "井上 なぎ", color: "#a78689", owner: 1, subtitle: "暮らしのなかの小さな話。" },
  { id: 6, title: "海辺の手紙", author: "青井 航", color: "#738e9b", owner: 2, subtitle: "まだ会えないあなたへ。" },
];

const pastTitles = ["春を待つ部屋", "小さな旅の記録", "台所の窓", "森へ帰る日", "午後の散歩", "星を拾う", "風の名前", "街の片隅で", "まどろみの庭", "手のひらの季節", "ひと駅先へ", "言葉の温度", "古い映画館", "朝の栞", "雨あがりの道"];
const pastBooks: Book[] = pastTitles.map((title, index) => ({
  id: index + 7,
  title,
  author: initialBooks[index % initialBooks.length].author,
  color: initialBooks[index % initialBooks.length].color,
  owner: index % people.length,
  subtitle: "みんなのライブラリに残る一冊。",
}));
const demoBooks = [...initialBooks, ...pastBooks];
const initialFinished = Object.fromEntries(
  demoBooks.filter((book) => book.id >= 4).map((book) => [book.id, [book.owner]])
);
const recentLimit = 6;
const pageSize = 8;

export default function MockRoom() {
  const [layout, setLayout] = useState<"together" | "people">("people");
  const [books, setBooks] = useState(demoBooks);
  const [selectedId, setSelectedId] = useState(2);
  const [myReading, setMyReading] = useState<number | null>(1);
  const [reactions, setReactions] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [finished, setFinished] = useState<Record<number, number[]>>(initialFinished);
  const [query, setQuery] = useState("");
  const [member, setMember] = useState("all");
  const [finishedOnly, setFinishedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const selected = books.find((book) => book.id === selectedId)!;
  const filteredBooks = books.filter((book) => {
    const matchesText = `${book.title} ${book.author}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    const matchesMember = member === "all" || book.owner === Number(member) || finished[book.id]?.includes(Number(member));
    const matchesFinished = !finishedOnly || (member === "all" ? finished[book.id]?.length > 0 : finished[book.id]?.includes(Number(member)));
    return matchesText && matchesMember && matchesFinished;
  });
  const lastPage = Math.max(0, Math.ceil(filteredBooks.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const visibleBooks = filteredBooks.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  function markFinished() {
    setFinished({ ...finished, [selected.id]: [...new Set([...(finished[selected.id] ?? []), 0])] });
    if (myReading === selected.id) setMyReading(null);
  }

  function readers(bookId: number) {
    const result: string[] = [];
    if (myReading === bookId) result.push("あなた");
    if (bookId === 2) result.push("あおい");
    if (bookId === 3) result.push("りく");
    return result;
  }

  function renderBook(book: Book) {
    const currentReaders = readers(book.id);
    return (
      <button key={book.id} className={`${styles.bookButton} ${selectedId === book.id ? styles.selected : ""}`} onClick={() => setSelectedId(book.id)} aria-label={`${book.title}、${people[book.owner]}が追加。詳細を見る`} aria-pressed={selectedId === book.id}>
        <span className={styles.cover} style={{ backgroundColor: book.color }}>
          <span className={styles.coverTop}>BOOK & DAYS</span>
          <span className={styles.coverTitle}>{book.title}</span>
          <span className={styles.coverLine} />
          <span className={styles.coverAuthor}>{book.author}</span>
        </span>
        <span className={styles.bookMeta}>{currentReaders.length > 0 ? <><span className={styles.readingDot} />{currentReaders.join("・")}が読書中</> : `${people[book.owner]}の一冊`}</span>
      </button>
    );
  }

  return (
    <div className={styles.app}>
      <header className={styles.topbar}><a href="/mock" className={styles.logo}>綴り<span>tsuzuri</span></a><span className={styles.mockLabel}>UI MOCK · 架空の本とメンバー / 更新でリセット</span><a className={styles.healthLink} href="/">接続確認 ↗</a></header>
      <main className={styles.main}>
        <div className={styles.roomIntro}>
          <div><p className={styles.eyebrow}>OUR LITTLE READING ROOM</p><h1>いつもの３人、<br className={styles.mobileBreak} />それぞれの一冊。</h1><p className={styles.description}>離れていても、同じ本棚で。最近なに読んでる？</p></div>
          <div className={styles.members}><div className={styles.avatarStack}>{people.map((person, index) => <span key={person} className={`${styles.avatar} ${styles[`person${index}`]}`} title={person}>{person.slice(0, 1)}</span>)}</div><span>いつもの３人の本棚</span></div>
        </div>

        <section className={styles.now} aria-label="いま読んでいる本">
          <span className={styles.nowLabel}><span className={styles.readingDot} />いま、読んでる</span>
          {people.map((person, index) => {
            const book = books.find((item) => item.id === (index === 0 ? myReading : index + 1));
            return <button key={person} className={styles.nowPerson} onClick={() => book && setSelectedId(book.id)} disabled={!book}><span className={`${styles.avatar} ${styles[`person${index}`]}`}>{person.slice(0, 1)}</span><span><b>{person}</b><span>{book?.title ?? "ひと休み中"}</span></span></button>;
          })}
        </section>

        <div className={styles.content}>
          <section className={styles.library} aria-label="みんなの本棚">
            <div className={styles.libraryHeader}><div><h2>みんなの本棚 <span>{books.length}冊</span></h2><p>読んだ日も、まだ読んでいない日も。</p></div><button className={styles.addButton} onClick={() => setAdding(!adding)} aria-expanded={adding}>{adding ? "閉じる" : "＋ 本を置く"}</button></div>
            {adding && <form className={styles.addForm} onSubmit={(event) => { event.preventDefault(); if (!title.trim()) return; const id = Math.max(...books.map((book) => book.id)) + 1; setBooks([{ id, title: title.trim(), author: "あなたが追加", color: "#6b7b69", owner: 0, subtitle: "本棚に、新しい一冊。" }, ...books]); setSelectedId(id); setTitle(""); setAdding(false); }}><label htmlFor="book-title">モックに置く本のタイトル</label><div><input id="book-title" value={title} maxLength={30} onChange={(event) => setTitle(event.target.value)} placeholder="気になっている一冊" required /><button type="submit">本棚に置く</button></div><small>製品版ではISBN検索から追加する想定です。</small></form>}
            <div className={styles.switcher} role="group" aria-label="本棚の表示案"><button aria-pressed={layout === "together"} onClick={() => setLayout("together")}>01 みんなでひとつ</button><button aria-pressed={layout === "people"} onClick={() => setLayout("people")}>02 ひとりずつの段</button></div>
            <p className={styles.recentHint}>追加した順に直近{recentLimit}冊 · 横にスクロール →</p>
            {layout === "together" ? (
              <div className={`${styles.shelf} ${styles.recentShelf}`} tabIndex={0} role="region" aria-label="みんなの最近の6冊">
                {books.slice(0, recentLimit).map(renderBook)}
              </div>
            ) : (
              <div className={styles.memberShelves}>
                {people.map((person, index) => (
                  <section key={person}>
                    <h3><span className={`${styles.avatar} ${styles[`person${index}`]}`}>{person.slice(0, 1)}</span>{person}の段</h3>
                    <div className={`${styles.shelf} ${styles.recentShelf}`} tabIndex={0} role="region" aria-label={`${person}の最近の6冊`}>
                      {books.filter((book) => book.owner === index).slice(0, recentLimit).map(renderBook)}
                    </div>
                  </section>
                ))}
              </div>
            )}
            <p className={styles.shelfHint}>ここに並びきらない本も、下のライブラリで見つかります。</p>

            <section className={styles.archive} aria-labelledby="library-title">
              <div className={styles.libraryHeader}>
                <div><h2 id="library-title">みんなのライブラリ <span>{books.length}冊</span></h2><p>これまでの一冊を、ここに残しておこう。</p></div>
              </div>
              <div className={styles.filters}>
                <label>本を探す<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="タイトル・著者で検索" /></label>
                <label>メンバー<select value={member} onChange={(event) => { setMember(event.target.value); setPage(0); }}><option value="all">みんな</option>{people.map((person, index) => <option key={person} value={index}>{person}</option>)}</select></label>
              </div>
              <label className={styles.finishedFilter}><input type="checkbox" checked={finishedOnly} onChange={(event) => { setFinishedOnly(event.target.checked); setPage(0); }} />読了した本だけ</label>
              <div className={styles.tableWrapper}>
                <table className={styles.bookTable}>
                  <thead><tr><th scope="col">タイトル / 著者</th><th scope="col">追加した人</th><th scope="col">読了した人</th></tr></thead>
                  <tbody>{visibleBooks.map((book) => (
                    <tr key={book.id} className={book.id === selectedId ? styles.activeRow : ""}>
                      <td><button onClick={() => setSelectedId(book.id)}>{book.title}</button><small>{book.author}</small></td>
                      <td>{people[book.owner]}</td>
                      <td>{finished[book.id]?.map((person) => people[person]).join("・") || "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {filteredBooks.length === 0 && <p className={styles.empty} role="status">条件に合う本はありません。</p>}
              <div className={styles.pagination}>
                <span aria-live="polite">{filteredBooks.length}冊 · {currentPage + 1} / {lastPage + 1}ページ</span>
                <div><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>前へ</button><button disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>次へ</button></div>
              </div>
            </section>
          </section>

          <aside className={styles.sidebar} aria-label="選んだ本の詳細">
            <section className={styles.detail}>
              <p className={styles.eyebrow}>PICKED FROM OUR SHELF</p><div className={styles.detailCover} style={{ backgroundColor: selected.color }}><span>{selected.title}</span><small>{selected.author}</small></div>
              <h2>{selected.title}</h2><p className={styles.author}>{selected.author}</p><p className={styles.quote}>{selected.subtitle}</p>
              <div className={styles.readerList} aria-live="polite">{readers(selected.id).length > 0 ? `${readers(selected.id).join("と")}が読んでいます` : "次は、誰の一冊になるだろう。"}</div>
              <button className={styles.primaryButton} onClick={() => setMyReading(myReading === selected.id ? null : selected.id)}>{myReading === selected.id ? "読書中を解除する" : "私もこれを読んでる"}</button>
              <button className={styles.finishedButton} disabled={finished[selected.id]?.includes(0)} onClick={markFinished}>{finished[selected.id]?.includes(0) ? "✓ あなたは読了済み" : "読み終わった！"}</button>
              <button className={styles.reaction} aria-pressed={reactions.includes(selected.id)} onClick={() => setReactions(reactions.includes(selected.id) ? reactions.filter((id) => id !== selected.id) : [...reactions, selected.id])}>{reactions.includes(selected.id) ? "♥ 気になる！を送りました" : "♡ 気になる！"}</button>
            </section>
            <section className={styles.note}><span>↳</span><div><h3>本棚から、会話がはじまる。</h3><p>「それ、気になってた」<br />次に会ったら、本の話をしよう。</p></div></section>
          </aside>
        </div>
        <footer className={styles.footer}><span>綴り — 本と、いつもの人たち。</span><span>デザイン検討用 / リアクションは提案機能</span></footer>
      </main>
    </div>
  );
}
