"use client";

import { useEffect, useState } from "react";
import type { User } from "oidc-client-ts";
import { authConfigured, getAuthManager, initializeAuth, login, logout } from "./session";
import ProfilePanel from "./profile-panel";

export default function AuthPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authConfigured) return;
    let active = true;
    const auth = getAuthManager();
    const expired = () => {
      void auth.removeUser();
      setUser(null);
      setError("ログインの有効期限が切れました。もう一度ログインしてください。");
    };
    auth.events.addAccessTokenExpired(expired);
    initializeAuth().then((value) => { if (active) setUser(value); })
      .catch(() => { if (active) setError("ログインを完了できませんでした。もう一度ログインしてください。"); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; auth.events.removeAccessTokenExpired(expired); };
  }, []);

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await action(); }
    catch { setError("認証画面へ移動できませんでした。通信状態を確認して再度お試しください。"); setBusy(false); }
  }

  return <section className="connection-card" aria-labelledby="auth-heading">
    <p className="eyebrow">YOUR ACCOUNT</p>
    <h2 id="auth-heading">{user ? "ログインしています" : "読書の時間を、いっしょに。"}</h2>
    {!authConfigured ? <p className="detail">このビルドには認証設定がありません。登録・ログインは準備中です。</p> : <>
      <p className="detail" role="status">{!ready ? "ログイン状態を確認しています…" : user ? `こんにちは、${user.profile.email ?? "読者さん"}` : "メールアドレスで登録できます。ログイン画面の「Sign up」から新規登録してください。"}</p>
      {error && <p role="alert" className="detail">{error}</p>}
      <button disabled={!ready || busy} onClick={() => void act(user ? logout : login)}>{busy ? "移動しています…" : user ? "ログアウト" : "登録・ログイン"}</button>
      {user && !busy && <ProfilePanel key={user.profile.sub} userId={user.profile.sub} />}
    </>}
    <p className="detail">本棚への参加・本の保存は準備中です。画面の見本とは別のアカウント機能です。</p>
  </section>;
}
