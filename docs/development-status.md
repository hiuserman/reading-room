# 実装状況
## フロント完成形への更新（2026-11-24）
- `/` はログイン・プロフィール・本棚・読書3タブのアプリ画面、以前の接続確認は `/dev` へ移動。
- `/mock` は同じUIを架空データで操作する明示的プレビュー。本棚作成・参加・本追加・投稿・ネタバレ開閉。保存はメモリー内のみ。
- 実APIはGET/POST `/api/me` のみ。本棚・本・投稿は `NEXT_PUBLIC_READING_API_ENABLED` が既定無効で、公開機能として成功扱いしない。
- Go実装用の契約は `frontend-api-handoff.md`。Go・DB・AWSの変更はなし。
- 型チェック・静的ビルド成功。ブラウザー接続が利用できず、操作・見た目の実ブラウザー検証は未完了。
- 2026-11-24再配信完了。公開API設定・読書API無効でビルド、S3反映・CloudFrontキャッシュ更新完了。`/`・`/mock`・`/dev`はHTTP 200を確認。静的ページの直接アクセス用にmock.html/dev.htmlを拡張子なしのS3キーにも配置（今後の配信でも同期が必要）。

## プロフィールAPI接続の追記（以下の記録より優先）
- GoのGET/POST /api/me、JWT検証、Usersテーブル・IAM・認証付きAPI Gatewayルートが実装された。未認証の401は利用者が確認済み。
- フロントはアクセストークンで/api/meを取得し、未登録なら表示名フォーム、登録成功なら返却されたプロフィールを表示する。再取得・401・403・409・通信エラーに対応。表示名の編集APIはない。
- フロントのJSONはGoに合わせてuser_id/display_name/created_at。認証済みの実アカウントによる404→201→200の通し確認は未確認。モックとは独立。

## 最新追記 2026-11-23（以下の過去記録より優先）
- S3＋CloudFrontのフロント公開、API Gateway＋Lambda＋GinのGET /api/healthは利用者が疎通確認済み。DB疎通は行わない。
- Cognito User Pool・メール自己登録・Hosted UI・公開クライアント・独自scope・API Gateway JWT authorizerをTerraformで作成済み。
- フロントにPKCEログイン、トップでのcallback処理、ログアウト、期限切れ案内を追加。実アカウントのメール確認を含む通し確認は利用者が実施する。
- JWT authorizerを適用した業務APIルートはまだない。healthのみ公開。本棚参加権限・GET /api/me・Usersの永続化は未実装。
- ローカルGoの本登録処理は維持。Lambdaでは本登録ルートを登録しない。今回Goコードは変更していない。
- API GatewayのCORSはCloudFront・localhost:3000からGETとAuthorization/Content-Typeを許可。ローカルGoのCORSとは別設定。
- 詳細と次のGo課題は[認証引き継ぎ](auth-handoff.md)。モックは引き続きサンプルデータ。

## 過去の確認記録
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
