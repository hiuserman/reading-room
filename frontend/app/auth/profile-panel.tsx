"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { getAccessToken, login } from "./session";

type Profile = { user_id: string; display_name: string; created_at: string };
type Phase = "loading" | "missing" | "ready" | "saving" | "error" | "unauthorized";
const endpoint = `${(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "")}/api/me`;

function isProfile(value: unknown, userId: string): value is Profile {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<Profile>;
  return p.user_id === userId && typeof p.display_name === "string" && p.display_name.trim().length > 0 && typeof p.created_at === "string";
}

export default function ProfilePanel({ userId }: { userId: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  const saving = useRef(false);

  const send = useCallback(async (displayName?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 10000);
    const posting = displayName !== undefined;
    setPhase(posting ? "saving" : "loading");
    setError("");
    setNotice("");
    try {
      const token = await getAccessToken();
      if (request.current !== controller) return;
      if (!token) { setPhase("unauthorized"); return; }
      const response = await fetch(endpoint, {
        method: posting ? "POST" : "GET",
        headers: { Authorization: `Bearer ${token}`, ...(posting ? { "Content-Type": "application/json" } : {}) },
        body: posting ? JSON.stringify({ display_name: displayName }) : undefined,
        cache: "no-store",
        signal: controller.signal,
      });
      const data: unknown = await response.json().catch(() => null);
      if (request.current !== controller) return;
      if (response.status === 401) { setPhase("unauthorized"); return; }
      if (!posting && response.status === 404 && data && typeof data === "object" && "error" in data && data.error === "プロフィールが未登録です") {
        setProfile(null);
        setPhase("missing");
        return;
      }
      if (posting && response.status === 409) {
        setPhase("error");
        setError("すでに登録されています。「保存済みの情報を確認」で読み直してください。");
        return;
      }
      if (!response.ok) {
        if (response.status === 403) throw new Error("プロフィールAPIへのアクセスが許可されていません。ログインし直しても続く場合は管理者へ連絡してください。");
        if (response.status === 400 || response.status === 413) {
          setPhase("missing");
          setError("表示名は前後の空白を除いて1〜30文字で入力してください。");
          return;
        }
        throw new Error(`プロフィールを${posting ? "保存" : "取得"}できませんでした（HTTP ${response.status}）。時間をおいて再確認してください。`);
      }
      if (!isProfile(data, userId)) throw new Error("プロフィールの応答形式を確認できませんでした。管理者へ連絡してください。");
      setProfile(data);
      setPhase("ready");
      if (posting) setNotice("プロフィールを保存しました。");
    } catch (err) {
      if (request.current !== controller) return;
      setPhase("error");
      setError(err instanceof Error && err.name !== "AbortError" && !(err instanceof TypeError)
        ? err.message
        : "通信を完了できませんでした。保存操作の後は、まず保存済みの情報を確認してください。");
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) request.current = null;
    }
  }, [userId]);

  useEffect(() => {
    void send();
    return () => { request.current?.abort(); request.current = null; };
  }, [send]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    const trimmed = name.trim();
    if (Array.from(trimmed).length < 1 || Array.from(trimmed).length > 30) {
      setError("表示名は1〜30文字で入力してください。");
      return;
    }
    saving.current = true;
    try { await send(trimmed); } finally { saving.current = false; }
  }

  return <div className="profile-panel" aria-labelledby="profile-heading">
    <h3 id="profile-heading">あなたのプロフィール</h3>
    <p role="status" className="detail">{phase === "loading" ? "保存済みのプロフィールを確認しています…" : phase === "saving" ? "プロフィールを保存しています…" : notice}</p>
    {error && <p role="alert" className="profile-error">{error}</p>}
    {(phase === "missing" || phase === "saving") && <form onSubmit={submit} noValidate>
      <p className="detail">はじめまして。本棚で使う表示名を登録してください。</p>
      <label htmlFor="profile-name">表示名</label>
      <input id="profile-name" name="display_name" autoComplete="nickname" value={name} onChange={(event) => { setName(event.target.value); setError(""); }} disabled={phase === "saving"} aria-describedby="profile-name-help" required />
      <p id="profile-name-help" className="detail">1〜30文字。メールアドレスではなく、好きな名前を使えます。</p>
      <button disabled={phase === "saving"} type="submit">{phase === "saving" ? "保存中…" : "表示名を登録する"}</button>
    </form>}
    {phase === "ready" && profile && <>
      <p className="profile-name">{profile.display_name}<span> さん</span></p>
      <p className="detail">保存済みのプロフィールです。表示名の変更は今後対応します。</p>
    </>}
    {(phase === "error" || phase === "ready") && <button className="profile-secondary" onClick={() => void send()}>保存済みの情報を確認</button>}
    {phase === "unauthorized" && <>
      <p className="detail">ログインの有効期限が切れたか、認証を確認できませんでした。</p>
      <button onClick={() => void login().catch(() => setError("ログイン画面を開けませんでした。再度お試しください。"))}>ログインし直す</button>
    </>}
  </div>;
}
