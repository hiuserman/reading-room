# フロントエンド開発環境

Next.js・React・TypeScriptの接続確認画面。フロントはCodex、バックエンドは利用者が担当する。

## 起動

プロジェクトルートで実行する。

```powershell
docker compose up -d --build
```

http://localhost:3000 を開く。フロントのファイル変更は自動反映される。Goの変更後は `docker compose restart backend` を実行する。

## APIとの接続

画面は `GET http://localhost:8080/api/health` をブラウザーから呼ぶ。200と `{"status":"ok"}` で成功、503と `{"status":"unavailable"}` でDB障害、それ以外はAPI接続エラーを表示する。8秒でタイムアウトし、ボタンで再確認できる。

接続先はComposeの `NEXT_PUBLIC_API_BASE_URL` で設定する。変更後はfrontendを再作成する。静的配信ではビルド時にこの値が埋め込まれるため、配備先ごとにビルドする。Goのhealth応答には開発画面 `http://localhost:3000` 用のCORSヘッダーを設定している。

## 型チェックと静的ビルド

開発サーバーとビルド出力が干渉しないよう、一時コンテナ内にソースをコピーして検証する。

```powershell
docker compose run --rm --no-deps frontend sh -c 'mkdir -p /tmp/frontend-check && cp -r app package.json package-lock.json next.config.ts next-env.d.ts tsconfig.json /tmp/frontend-check/ && cd /tmp/frontend-check && npm ci && npm run typecheck && npm run build'
```

`output: 'export'` で静的出力する。ビルド中のDB接続は不要。

## トラブル確認

```powershell
docker compose logs --tail 50 frontend backend
```

画面がDB接続エラーを表示する場合はDynamoDBの起動とGoのログを確認する。API接続エラーはAPI停止・不正な応答・CORS・タイムアウトなどを含む。
