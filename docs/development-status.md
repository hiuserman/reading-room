# 実装状況
2026-11-16 ／ 手元のコードを確認。GitHub側のマージ状態とは別。

## 実コード
- GinのGET /api/healthは固定200とHello, World!を返す。DB疎通チェックは現在行わない。
- POST /api/shelves/{shelfID}/books: title/authorsをJSONで受信、UUIDを生成しShelfBooksへ保存。成功200。書名必須の検証なし、createdAtは固定。
- book.GetBooksByShelfIDはScanとフィルターによる取得関数。main.goにGETルートの登録はまだない。ページ取得・空配列対応は未実装。
- CORS未設定。ブラウザーのlocalhost:3000から直接APIを呼ぶにはGo側の許可設定が必要。
- / はAPI接続確認。/mockは投稿・進捗・ネタバレ開閉と本棚を試せる見本。サンプルデータで、再読込でリセット。
- 投稿・最新状態・メンバー権限・認証・ISBN・AWS配備は未実装。

## 次のバックエンド課題
1. 一覧GETルート、Query＋ページ取得、空配列、context伝播。
2. 登録の入力検証、現在日時、201と登録本レスポンス。
3. localhost:3000のCORS（GET/POST/OPTIONS、Content-Type）。
4. ReadingPostsとReadingRecordsの保存・取得・入力検証。
5. 認証と本棚参加権限。公開前に必須。

GoコードとDBは今回変更していない。現行APIはapi.yaml、提出用の目標APIはrequirements.mdを参照。

## UI改訂 2026-11-17
/mockを幅430pxの中央配置へ刷新。みんな／記録する／本の3画面。タブ間でサンプル投稿を保持し、再読込でリセット。Go・DB・認証は変更なし。

## バックエンド設計更新 2026-11-17
[実装計画](backend-plan.md)に画面別API、JSON、配置案、期限までの作業順を追加。ReadingRecordsの目標キーを棚＋本人/本へ変更し、RequestDedupの目標テーブルを追加。実装済みAPI・Go・実DBは今回変更していない。最初の作業は本GETルートとQueryによる一覧取得。
