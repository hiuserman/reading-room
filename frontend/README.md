# フロントエンド

2026-11-24: 完成形のスマホUIへ更新。

- `/`: ログイン・プロフィール登録・本棚・読書画面。本棚APIは準備中のため既定で無効。
- `/mock`: 同じ画面を架空データで操作するプレビュー。再読込でリセット、DB保存なし。
- `/dev`: 既存のAPI接続確認。

起動はルートで `docker compose up -d --build`。http://localhost:3000/mock で見本を確認。

実装済みAPIはGET/POST `/api/me`。本棚・本・投稿APIの接続先と入力出力は `../docs/frontend-api-handoff.md` に記載。GoとAWSで実装・権限確認が終わってから `NEXT_PUBLIC_READING_API_ENABLED=true` を指定して再ビルドする。

Next.jsは静的出力。API URLと認証設定はビルド時に埋め込む。公開ビルドではComposeのlocalhost用API URLを上書きする。

検証: `npm run typecheck`、`npm run build`。Goコード・DBはこの変更の対象外。
