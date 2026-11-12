"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ConnectionState = "checking" | "connected" | "database-error" | "connection-error";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const healthUrl = `${apiBaseUrl}/api/health`;
const messages: Record<ConnectionState, { title: string; detail: string; label: string }> = {
  checking: { title: "接続を確認しています", detail: "Go APIを経由して、DynamoDBの応答を確認します。", label: "確認中" },
  connected: { title: "DynamoDB に接続できました", detail: "画面からAPI、データベースまでの通信ができています。", label: "接続済み" },
  "database-error": { title: "DynamoDB に接続できません", detail: "Go APIは応答しています。DBの起動状態とバックエンドのログを確認してください。", label: "DB接続エラー" },
  "connection-error": { title: "APIとの接続を確認してください", detail: "APIの起動状態、接続先URL、CORS設定を確認して、もう一度お試しください。", label: "接続エラー" },
};

export default function Home() {
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const checkConnection = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setConnection("checking");
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(healthUrl, { cache: "no-store", signal: controller.signal });
      const result: unknown = await response.json();
      if (activeRequest.current !== controller) return;

      const status = result && typeof result === "object" && "status" in result ? result.status : null;
      if (response.ok && status === "ok") {
        setConnection("connected");
      } else if (response.status === 503 && status === "unavailable") {
        setConnection("database-error");
      } else {
        setConnection("connection-error");
      }
    } catch {
      if (activeRequest.current === controller) setConnection("connection-error");
    } finally {
      window.clearTimeout(timeout);
      if (activeRequest.current === controller) {
        setCheckedAt(new Date().toLocaleTimeString("ja-JP"));
        activeRequest.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void checkConnection();
    return () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [checkConnection]);

  const message = messages[connection];

  return (
    <main className="workspace">
      <header className="header">
        <a className="brand" href="/" aria-label="私の本棚 ホーム"><span aria-hidden="true">▥</span> 私の本棚</a>
        <span className="environment"><span /> LOCAL DEVELOPMENT</span>
      </header>

      <section className="intro">
        <p className="eyebrow">YOUR PERSONAL LIBRARY</p>
        <h1>共同本棚の、<br />いまを確かめる。</h1>
        <p className="lead">レッスン用の開発状況・接続確認ページです。<br />下の結果はGo APIから実際に取得しています。</p>
        <div className="books" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      </section>

      <section className="connection-card" aria-labelledby="connection-heading">
        <div className="card-header"><p className="eyebrow">接続確認</p><span className={`badge ${connection}`}>{message.label}</span></div>
        <div role="status" aria-live="polite" aria-atomic="true">
          <h2 id="connection-heading">{message.title}</h2>
          <p className="detail">{message.detail}</p>
        </div>
        <ol className="flow" aria-label="通信経路"><li>Next.js<span>画面</span></li><li>Go API<span>バックエンド</span></li><li>DynamoDB<span>データベース</span></li></ol>
        <div className="endpoint"><span>確認先</span><code>{healthUrl}</code></div>
        <div className="card-footer">
          <span className="timestamp">{checkedAt ? `最終確認 ${checkedAt}` : "初回接続を確認中"}</span>
          <button disabled={connection === "checking"} onClick={() => void checkConnection()}>{connection === "checking" ? "確認中…" : "もう一度確認する"}<span aria-hidden="true"> ↗</span></button>
        </div>
      </section>
      <section className="progress-card" aria-labelledby="progress-heading">
        <p className="eyebrow">IMPLEMENTATION STATUS</p>
        <h2 id="progress-heading">できることと、これから</h2>
        <p className="detail">以下はコード確認時点（2026年11月12日）の状況です。接続確認の成功は、各機能の完成を意味しません。</p>
        <dl className="progress-list">
          <div><dt>DB疎通確認 <span className="badge connected">実装済み</span></dt><dd>GET /api/health でGoからDynamoDBの応答を確認します。</dd></div>
          <div><dt>本の登録 <span className="badge">試作</span></dt><dd>固定の本棚ID・本IDをBooksテーブルへ保存する段階です。現在のGET APIは書込みを行うため、この画面からは実行しません。</dd></div>
          <div><dt>一覧・ISBN検索・読書状態 <span className="badge">未実装</span></dt><dd>業務APIとの接続はこれから。まず登録と一覧取得を順に実装します。</dd></div>
          <div><dt>認証・共有・AWS公開 <span className="badge">設計中</span></dt><dd>現在はDocker Composeによるローカル環境です。</dd></div>
        </dl>
        <div className="reference-links"><a href="http://localhost:8001/" target="_blank" rel="noreferrer">DB管理画面を開く ↗</a><a href="/mock">将来UIのモックを見る →</a></div>
        <p className="detail">モックはサンプルデータのみで、DBとは未接続です。再読み込みすると初期状態に戻ります。</p>
      </section>
      <footer className="footer"><span>共同本棚 · 開発環境</span><span>React + TypeScript / Go / DynamoDB</span></footer>
    </main>
  );
}
