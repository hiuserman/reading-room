# 認証基盤とGoへの引き継ぎ

2026-11-23。Goコードは変更していない。

## 構成
- Cognito User Pool: メール登録・確認・ログイン・パスワード再設定。
- LiteプランのHosted UI（classic）を利用。クライアントシークレットなし。
- Authorization Code + PKCE。フロントはoidc-client-tsでstate・コード交換を処理する。
- コールバックとログアウト先は公開サイトの `/` と `http://localhost:3000/`。S3への直接アクセスでもトップを返せる構成。
- セッションはタブ内sessionStorage。自動更新はしない。アクセストークンの期限15分後は再ログインを案内する。
- ログアウト時はrefresh tokenの失効を試み、ローカルセッションを削除してCognitoのlogoutへ移動する。発行済みaccess tokenが即時無効になるとは限らない。
- モックは引き続き架空データ。ログインしてもDB保存や本棚参加はまだ起きない。

## AWSへの反映
`infra/api/auth.tf` はCognito、独自scope `reading-room/access`、API Gateway JWT authorizerを定義。
healthは公開のまま。JWT authorizerは準備済みだが、保護するルートはまだ登録していない。
初期メール送信はCognito標準送信。大人数の利用前は送信上限・SES設定を確認する。

## 次に利用者が実装するGo
最初は `GET /api/me` で検証済みの本人IDを返すところから始める。現時点では未実装。

1. フロントから `Authorization: Bearer <access_token>` を送る。ID tokenはAPIへ送らない。
2. Goの認証middlewareでJWT署名（RS256/JWKS）、issuer、期限、`token_use=access`、`client_id`、scopeを検証する。JWTをデコードするだけでは不可。JWKSはキャッシュし、鍵ローテーションに対応する。
3. 検証済み `sub` をユーザーIDとしてGin contextへ格納する。JSONや任意のヘッダーのuserIdは信用しない。
4. handlerはcontextから本人IDを取得する。Usersを作る場合は条件付き書き込み等で初回処理を冪等にする。
5. 本棚APIはShelfMembersで参加権限を毎回確認する。認証済みでも全棚の閲覧・更新を許可しない。

Lambda Web AdapterはHTTPへ変換するため、この初期構成ではGoがAuthorizationヘッダーを自分で検証する方針。JWT authorizerの検証済み情報を利用する設計へ変える場合は、その受け渡しと信頼境界を別途確認する。

Go環境変数に設定する値（現在は未設定）:
- COGNITO_ISSUER: `terraform output -json auth_frontend` のauthority
- COGNITO_CLIENT_ID: 同client_id
- COGNITO_REQUIRED_SCOPE: `reading-room/access`
- JWKS URL: issuerに `/.well-known/jwks.json` を追加

`GET /api/me` 実装後に追加するTerraformルートの設定:
```hcl
authorization_type   = "JWT"
authorizer_id        = aws_apigatewayv2_authorizer.readers.id
authorization_scopes = ["reading-room/access"]
```
新ルート用Lambda呼び出し権限も追加する。現状はhealthへの許可のみ。
POST等を公開する段階でCORSのallow_methodsを拡張する。CORSは認証ではない。

## フロント再ビルド
1. `infra/api/export-frontend-env.ps1` でTerraform outputを `.env.production` へ出力。
2. ルートから `docker compose run --rm --no-deps -e NEXT_PUBLIC_API_BASE_URL=https://6n9n6qs6dg.execute-api.ap-northeast-1.amazonaws.com frontend sh -lc "npm run typecheck && npm run build"`。
3. `frontend/out`の中身を既存S3へアップロードしてCloudFrontを更新。

ComposeはローカルAPIの環境変数を設定しているため、公開ビルド時は上記の `-e` が必要。Next.jsの公開環境変数はビルド時に埋め込まれる。CIでも同じ値を渡す。秘密鍵・パスワードは不要。
ローカルで認証を試す場合は `.env.example` を参考に `.env.local` へ公開設定値を入れてfrontendを再起動する。

## 確認項目
- 未ログイン→Cognito→新規登録→メール確認→ログイン→トップでメール表示。
- ログアウト→未ログイン表示。期限切れ→再ログイン案内。
- 不正なstateや未開始のcallbackでログイン扱いにならず、エラーを表示。
- healthはログイン不要、DB疎通ではない。
- パスワード入力・メールコード確認を含む実アカウントの通し確認は利用者が行う。

参考: https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html
参考: https://authts.github.io/oidc-client-ts/
