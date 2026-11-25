"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "oidc-client-ts";
import { api, ApiError, readingApiEnabled, type Profile, type Shelf, type ShelfDetail } from "../../lib/reading-api";
import { authConfigured, getAuthManager, initializeAuth, login, logout } from "../auth/session";
import { createPreviewApi, previewProfile } from "./preview-api";
import Library from "./library";
import s from "./reading.module.css";

const count = (value: string) => Array.from(value).length;
const errorMessage = (error: unknown) => error instanceof ApiError ? error.message : "通信を完了できませんでした。時間をおいて、もう一度お試しください。";

function Mark() { return <span className={s.brandMark} aria-hidden="true">綴</span>; }
function Back({ onClick }: { onClick: () => void }) { return <button className={s.backButton} onClick={onClick}>← 戻る</button>; }

export default function ReadingApp({ preview = false }: { preview?: boolean }) {
  const [client] = useState(() => preview ? createPreviewApi() : api);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(preview || !authConfigured);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preview || !authConfigured) return;
    let active = true;
    const auth = getAuthManager();
    const expired = () => {
      void auth.removeUser();
      if (active) { setUser(null); setError("ログインの有効期限が切れました。もう一度ログインしてください。読書記録の下書きはこのタブに残しています。"); }
    };
    auth.events.addAccessTokenExpired(expired);
    initializeAuth().then(value => { if (active) setUser(value); })
      .catch(() => { if (active) setError("ログインを完了できませんでした。もう一度お試しください。"); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; auth.events.removeAccessTokenExpired(expired); };
  }, [preview]);

  async function signIn() {
    if (busy) return;
    setBusy(true); setError("");
    try { await login(); } catch { setError("ログイン画面を開けませんでした。通信状態を確認してください。"); setBusy(false); }
  }
  async function signOut() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (user) {
        const prefix = `tsuzuri:draft:${user.profile.sub}:`;
        try { for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix)) sessionStorage.removeItem(key); } catch { /* Storage can be disabled. */ }
      }
      await logout();
    } catch { setError("ログアウトを完了できませんでした。もう一度お試しください。"); setBusy(false); }
  }

  return <div className={s.stage}><div className={s.shell}>
    <header className={s.header}><a className={s.brand} href={preview ? "/mock" : "/"} aria-label="綴り ホーム"><Mark /><span>綴り<small>tsuzuri</small></span></a><span className={s.eyebrow}>A LITTLE READING, EVERY DAY.</span></header>
    {preview && <div className={s.previewBanner}><strong>PREVIEW</strong><span>架空のデータ・保存されません</span><a href="/">ログインへ ↗</a></div>}
    {!ready ? <main className={s.main}><p className={s.loading} role="status">あなたの本棚を開いています…</p></main> : preview || user ? <>
      {error && <p className={s.error} role="alert">{error}</p>}
      <ProfileGate key={preview ? "preview" : user!.profile.sub} client={client} userId={preview ? previewProfile.user_id : user!.profile.sub} preview={preview} busy={busy} onLogout={() => void signOut()} onLogin={() => void signIn()} />
    </> : <main className={s.main}>
      <section className={s.hero}><p className={s.eyebrow}>READING, TOGETHER.</p><h1 className={s.title}>同じ時間に、<br />違うページを。</h1><p className={s.subtitle}>読んだ日も、ひと休みの日も。<br />本とひとことを持ち寄る、小さな場所。</p><div className={s.heroArt} aria-hidden="true"><div className={s.heroBook}><span>夜の余白</span><small>綴り文庫</small></div><div className={s.heroBookTwo}><span>今日の、栞。</span><small>A READING MOMENT</small></div></div>
        {error && <p className={s.error} role="alert">{error}</p>}
        {authConfigured ? <><button className={s.primary} disabled={busy} onClick={() => void signIn()}>{busy ? "ログイン画面へ移動中…" : "本棚をはじめる / ログイン"}<span aria-hidden="true"> ↗</span></button><p className={s.hint}>メールアドレスで登録できます。初めての方はログイン画面の「Sign up」へ。</p></> : <p className={s.notice}>アカウントの受付は準備中です。先に画面の見本をお試しいただけます。</p>}
        <a className={s.secondary} href="/mock">まずは、読書の風景をのぞく</a>
      </section>
      <section className={s.panel}><p className={s.eyebrow}>YOUR OWN READING CIRCLE</p><h2 className={s.sectionTitle}>本の話を、いつもの人と。</h2><p className={s.muted}>今読んでいる本。心に残ったひとこと。<br />頑張りすぎず、お互いの読書をそっと知る。</p><div className={s.buttonRow}><span className={s.badge}>現在ページ</span><span className={s.badge}>読書中・ひと休み・読了</span><span className={s.badge}>ネタバレを隠す</span></div></section>
      <footer className={s.footer}>綴り · 自分のペースで、つづけよう。<a href="/dev">接続状況</a></footer>
    </main>}
  </div></div>;
}

function ProfileGate({ client, userId, preview, busy, onLogout, onLogin }: { client: typeof api; userId: string; preview: boolean; busy: boolean; onLogout: () => void; onLogin: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(preview ? previewProfile : null);
  const [phase, setPhase] = useState<"loading" | "missing" | "ready" | "error">(preview ? "ready" : "loading");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setPhase("loading"); setError(""); setUnauthorized(false);
    try {
      const value = await client.getProfile(controller.signal);
      if (controller.signal.aborted) return;
      if (value.user_id !== userId) throw new Error("Unexpected profile owner");
      setProfile(value); setPhase("ready");
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof ApiError && err.code === "PROFILE_NOT_FOUND") setPhase("missing");
      else { setError(errorMessage(err)); setUnauthorized(err instanceof ApiError && err.status === 401); setPhase("error"); }
    }
  }, [client, userId]);

  useEffect(() => { mounted.current = true; if (!preview) void load(); return () => { mounted.current = false; request.current?.abort(); }; }, [load, preview]);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const trimmed = name.trim();
    if (count(trimmed) < 1 || count(trimmed) > 30) { setError("表示名は1〜30文字で入力してください。"); return; }
    lock.current = true; setSaving(true); setError("");
    try {
      const value = await client.createProfile(trimmed);
      if (!mounted.current) return;
      if (value.user_id !== userId) throw new Error("Unexpected profile owner");
      setProfile(value); setPhase("ready");
    } catch (err) {
      if (!mounted.current) return;
      setError(errorMessage(err));
      if (!(err instanceof ApiError && (err.status === 400 || err.status === 413))) { setPhase("error"); setUnauthorized(err instanceof ApiError && err.status === 401); }
    } finally { lock.current = false; if (mounted.current) setSaving(false); }
  }

  if (phase === "ready" && profile) return <ShelfHome client={client} profile={profile} preview={preview} busy={busy} onLogout={onLogout} onLogin={onLogin} />;
  return <main className={s.main}><section className={s.panel}>
    <p className={s.eyebrow}>WELCOME TO TSUZURI</p><h1 className={s.title}>あなたの名前を、<br />本棚に。</h1>
    {phase === "loading" && <p className={s.loading} role="status">プロフィールを確認しています…</p>}
    {error && <p className={s.error} role="alert">{error}</p>}
    {phase === "missing" && <form className={s.form} noValidate onSubmit={register}><label className={s.field}>表示名<input autoComplete="nickname" value={name} onChange={event => setName(event.target.value)} disabled={saving} placeholder="本棚で呼ばれたい名前" aria-describedby="name-hint" required /></label><p id="name-hint" className={s.hint}>1〜30文字。メールアドレスではなく、好きな名前で。</p><button className={s.primary} disabled={saving}>{saving ? "登録しています…" : "この名前ではじめる"}</button></form>}
    {phase === "error" && <><button className={s.primary} onClick={unauthorized ? onLogin : () => void load()}>{unauthorized ? "ログインし直す" : "保存済みのプロフィールを確認"}</button><p className={s.hint}>保存途中で通信が切れた場合も、登録済みかを確認できます。</p></>}
    <button className={s.textButton} disabled={busy || saving} onClick={onLogout}>ログアウト</button>
  </section></main>;
}

function ShelfHome({ client, profile, preview, busy, onLogout, onLogin }: { client: typeof api; profile: Profile; preview: boolean; busy: boolean; onLogout: () => void; onLogin: () => void }) {
  const enabled = preview || readingApiEnabled;
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [shelf, setShelf] = useState<ShelfDetail | null>(null);
  const [screen, setScreen] = useState<"shelves" | "create" | "join" | "library" | "account">("shelves");
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);

  function navigate(value: typeof screen) { setError(""); setNotice(""); setScreen(value); window.scrollTo({ top: 0 }); }
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [screen]);

  function fail(err: unknown) {
    setError(errorMessage(err));
    setUnauthorized(err instanceof ApiError && err.status === 401);
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) setShelf(null);
  }
  const loadShelves = useCallback(async () => {
    if (!enabled) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(""); setUnauthorized(false);
    try {
      const collected: Shelf[] = []; let cursor: string | undefined; const seen = new Set<string>();
      for (let step = 0; step < 100; step++) {
        const page = await client.listShelves(cursor, controller.signal); collected.push(...page.items);
        if (page.nextCursor === null) { if (!controller.signal.aborted) { setShelves(Array.from(new Map(collected.map(item => [item.shelfId, item])).values())); setUncertain(false); } return; }
        if (seen.has(page.nextCursor)) throw new Error("Invalid pagination");
        seen.add(page.nextCursor); cursor = page.nextCursor;
      }
      throw new Error("Too many pages");
    } catch (err) { if (!controller.signal.aborted) { setError(errorMessage(err)); setUnauthorized(err instanceof ApiError && err.status === 401); setShelves([]); } }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [client, enabled]);

  useEffect(() => { mounted.current = true; void loadShelves(); return () => { mounted.current = false; request.current?.abort(); }; }, [loadShelves]);

  async function openShelf(id: string) {
    if (lock.current) return;
    lock.current = true; setLoading(true); setError("");
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    try {
      const value = await client.getShelf(id, controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      setShelf(value); navigate("library");
    } catch (err) { if (!controller.signal.aborted && mounted.current) fail(err); }
    finally { lock.current = false; if (mounted.current && !controller.signal.aborted) setLoading(false); }
  }

  async function saveShelf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current || !enabled || uncertain) return;
    const joining = screen === "join";
    const value = (joining ? invite : name).trim();
    if (!value || count(value) > (joining ? 256 : 60)) { setError(joining ? "招待コードを入力してください（256文字以内）。" : "本棚の名前は1〜60文字で入力してください。"); return; }
    lock.current = true; setSaving(true); setError("");
    try {
      const result = joining ? await client.joinShelf(value) : await client.createShelf(value);
      if (!mounted.current) return;
      setShelves(previous => [...previous.filter(item => item.shelfId !== result.shelfId), result]);
      setName(""); setInvite("");
      // Opening the shelf is a separate read; its failure must not repeat creation.
      navigate("shelves"); setNotice(joining ? "本棚に参加しました。本棚を選んで開いてください。" : "本棚を作りました。最初の一冊を加えましょう。");
    } catch (err) {
      if (!mounted.current) return;
      fail(err);
      if (!(err instanceof ApiError) || err.status === 0 || err.status >= 500) setUncertain(true);
    } finally { lock.current = false; if (mounted.current) setSaving(false); }
  }

  async function copyInvite() {
    try { await navigator.clipboard.writeText(shelf!.inviteCode!); setNotice("招待コードをコピーしました。"); }
    catch { setNotice("コードを選択してコピーしてください。"); }
  }

  if (screen === "library" && shelf) return <>
    <div className={s.shelfPicker}><button className={s.textButton} onClick={() => navigate("shelves")} aria-label="本棚を切り替える">{shelf.name} <span aria-hidden="true">⌄</span></button><button className={s.avatar} aria-label="プロフィールとメンバー" onClick={() => navigate("account")}>{Array.from(profile.display_name)[0]}</button></div>
    <Library key={shelf.shelfId} client={client} profile={profile} shelf={shelf} preview={preview} onShelves={() => navigate("shelves")} onAccount={() => navigate("account")} />
  </>;

  return <main className={s.main}>
    {screen !== "shelves" && <Back onClick={() => navigate(screen === "account" && shelf ? "library" : "shelves")} />}
    {screen === "shelves" && <>
      <div className={s.sectionHeading}><div><p className={s.eyebrow}>YOUR READING CIRCLE</p><h1 className={s.title} ref={heading} tabIndex={-1}>あなたの本棚。</h1></div><button className={s.avatar} aria-label="プロフィールを開く" onClick={() => navigate("account")}>{Array.from(profile.display_name)[0]}</button></div>
      <p className={s.subtitle}>{profile.display_name}さん、おかえりなさい。<br />今日も、自分のペースで。</p>
      {!enabled ? <section className={s.empty}><span className={s.emptyIcon} aria-hidden="true">▤</span><h2 className={s.sectionTitle}>本棚は、もうすぐ。</h2><p>プロフィールの登録は完了しています。<br />本棚の作成・共有はただいま準備中です。</p><a className={s.primary} href="/mock">完成イメージを試す ↗</a></section> : <>
        {loading && <p className={s.loading} role="status">本棚を開いています…</p>}
        {!loading && !shelves.length && !error && <div className={s.empty}><span className={s.emptyIcon} aria-hidden="true">▤</span><h2 className={s.sectionTitle}>最初の、本棚を。</h2><p>ひとりで始めても、誰かと一緒でも。<br />好きな本を持ち寄る場所を作りましょう。</p></div>}
        <div className={s.form}>{shelves.map(item => <button className={s.optionCard} key={item.shelfId} disabled={loading || saving} onClick={() => void openShelf(item.shelfId)}><span aria-hidden="true">▤</span><strong>{item.name}</strong><span aria-hidden="true">→</span></button>)}</div>
        <div className={s.buttonRow}><button className={s.primary} disabled={loading} onClick={() => navigate("create")}>＋ 本棚を作る</button><button className={s.secondary} disabled={loading} onClick={() => navigate("join")}>招待コードで参加</button></div>
        <button className={s.textButton} disabled={loading} onClick={() => void loadShelves()}>本棚の一覧を更新</button>
      </>}
    </>}
    {(screen === "create" || screen === "join") && <section className={s.panel}>
      <p className={s.eyebrow}>{screen === "create" ? "A PLACE FOR YOUR BOOKS" : "READING WITH FRIENDS"}</p><h1 className={s.title} ref={heading} tabIndex={-1}>{screen === "create" ? "本棚に、名前を。" : "いつもの人の、本棚へ。"}</h1>
      <p className={s.subtitle}>{screen === "create" ? "一緒に読みたい人は、あとから招待できます。" : "本棚を作った人から、招待コードを受け取ってください。"}</p>
      {preview && screen === "join" && <p className={s.hint}>見本の招待コード：TSUZURI</p>}
      <form className={s.form} noValidate onSubmit={saveShelf}>
        {screen === "create" ? <label className={s.field}>本棚の名前<input value={name} onChange={event => setName(event.target.value)} disabled={saving || uncertain} placeholder="いつもの本棚" required /><span className={s.hint}>1〜60文字</span></label> : <label className={s.field}>招待コード<input value={invite} onChange={event => setInvite(event.target.value)} disabled={saving || uncertain} autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder="受け取ったコード" required /></label>}
        <button className={s.primary} disabled={saving || uncertain || !enabled}>{saving ? "保存しています…" : screen === "create" ? "本棚を作る" : "この本棚に参加する"}</button>
      </form>
      {uncertain && <div className={s.notice}><p>操作が完了した可能性があります。再送する前に、本棚一覧で結果を確認してください。</p><button className={s.secondary} onClick={() => { navigate("shelves"); void loadShelves(); }}>本棚一覧を確認</button></div>}
    </section>}
    {screen === "account" && <section className={s.account}>
      <p className={s.eyebrow}>YOUR PROFILE</p><span className={s.avatar} aria-hidden="true">{Array.from(profile.display_name)[0]}</span><h1 className={s.accountName} ref={heading} tabIndex={-1}>{profile.display_name}</h1><p className={s.muted}>読んだ日も、ひと休みの日も。</p>
      {shelf && <section className={s.panel}><h2 className={s.sectionTitle}>{shelf.name}</h2><p className={s.hint}>{shelf.members.length}人の読書仲間</p>{shelf.members.map(member => <div className={s.memberRow} key={member.userId}><span className={s.avatar} aria-hidden="true">{Array.from(member.displayName)[0]}</span><span>{member.displayName}</span>{member.userId === profile.user_id && <small>あなた</small>}</div>)}
        {shelf.inviteCode && <><h3 className={s.sectionTitle}>本棚に招待する</h3><p className={s.hint}>このコードを知っている人が参加できます。一緒に読みたい人にだけ伝えてください。</p><code className={s.inviteCode}>{shelf.inviteCode}</code><button className={s.secondary} onClick={() => void copyInvite()}>招待コードをコピー</button></>}
      </section>}
      <button className={s.secondary} onClick={() => navigate("shelves")}>本棚を選ぶ</button>
      {preview ? <a className={s.textButton} href="/">見本を閉じてログインへ</a> : <button className={s.textButton} disabled={busy} onClick={onLogout}>{busy ? "ログアウトしています…" : "ログアウト"}</button>}
      <p className={s.hint}>表示名の変更は、今後対応します。</p>
    </section>}
    {error && <div className={s.error} role="alert"><p>{error}</p>{unauthorized && <button className={s.secondary} onClick={onLogin}>ログインし直す</button>}</div>}
    {notice && <p className={s.notice} role="status">{notice}</p>}
    {preview && <footer className={s.footer}>見本の操作です。再読み込みで最初に戻ります。</footer>}
  </main>;
}
