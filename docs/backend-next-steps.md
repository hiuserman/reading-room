# バックエンド着手手順（2026-11-24）

## この資料の位置付け
利用者が約2時間後に作業を再開するための実装計画。Goコード、Terraform、実DBは変更していない。以下は未実装の提案。フロントの目標JSONは [frontend-api-handoff.md](frontend-api-handoff.md)、過去の詳細案は [backend-plan.md](backend-plan.md)。実装済みAPIの資料 api.yaml は /me 未反映のため、今は実コードと照合する。

## 確認した現在地
- App/auth: VerifyTokenとJWT middleware、単体テストあり。本人IDはc.GetString("userID")で取得する。
- App/user: GET/POST /api/me実装あり。Usersのキーはuser_id。認証済み実アカウントの保存→再取得は、会話上まだ確認できていない。
- App/main.go: ローカルは本POSTのみ、Lambdaはmeのみ。healthは固定応答でDB確認ではない。Lambda Web AdapterをTerraformで設定済みなので、Lambda SDKへの再移行は不要。
- App/book: POSTは書名検証なし・日時固定・成功200/messageのみ。storeは固定テーブル名・context.TODO・panic。GETはScan関数のみでルート未登録。
- shelf/readingパッケージなし。Terraformで定義した業務テーブルはUsersのみ。既存DBの実テーブルは今回照会していない。
- フロントは本棚・本・投稿の接続コードあり。ただしNEXT_PUBLIC_READING_API_ENABLEDは無効。部分実装で有効化すると未完成APIも呼ぶため、API単位の検証には先にHTTPテストを使う。
- Git作業ツリーには未コミットのフロント・資料の変更がある。Goの作業と混ぜず、まず変更対象を確認する。

## 実装順と区切り
|順|実装|完了の目印|
|---|---|---|
|0|公開画面で登録・メール確認・ログイン・表示名登録|GET me 404→POST 201→GET 200。既登録ならGET 200でよい|
|1|棚作成と棚詳細、共通の参加者確認|Aが棚を作るとownerとして参加。Aは取得200、未参加Bは403|
|2|参加棚一覧|Aの棚だけを返す。空はitems:[]。再ログインしても棚を選べる|
|3|招待コード参加|Bがコードで参加して棚を取得。再参加は重複しない。未参加Cは403|
|4|本POSTの修正と本GET|2冊保存→再取得。31冊以上もページ継続。別棚にアクセス不可|
|5|読書投稿POSTと本人の最新状態GET|120→180の履歴を保持、最新180。AとBを分離、二重送信で増えない|
|6|投稿一覧GET|新しい順6件、本・投稿者情報付き。7件目以降もDBに保持|
|7|フロント有効化と2人で通し確認|登録→棚作成/参加→本追加→投稿→他の人が閲覧→再読込|

各区切りでGoの確認とAWSのルート・テーブル・IAMをそろえる。全部書いてから初めてデプロイしない。金曜は結合修正の時間を確保し、写真/ISBN/返信/統計/自動デプロイ新設は後回し。

## 最初の作業枠（約2時間の目安）
「2時間後に再開」と「2時間で全機能完成」は別。初回枠の中心は棚作成と、その保存内容を読む処理。

1. 0〜15分: git status、公開画面でmeを確認。ここで失敗する場合は認証・IAM・DBを直し、後続を詰め込まない。
2. 15〜35分: shelf/model.goに保存型と応答型を定義する。棚名、owner/member、activeを決める。
3. 35〜70分: shelf/store.goに棚＋owner参加情報の同時保存、棚取得、参加者取得を実装する。
4. 70〜100分: service.goに入力検証・ID/日時生成、handler.goにPOST/GET、main.goに認証付きルートを追加する。
5. 100〜120分: 入力検証・未認証のテスト、go test/go vet。時間が残ればTerraform追加・AWS確認。AWS公開まで終わらなければ次枠の冒頭に回す。

参加棚一覧・招待参加は次の枠に分けてよい。公開用APIを無認証で仮開放して時間短縮しない。

## Goの配置と責務
- main.go: DBと設定の生成、Handlerの生成、ルート登録。
- shelf/model.go: Shelf、Membership、Invite、ShelfResponse、ShelfDetailResponse、一覧型。
- shelf/store.go: GetShelf、GetMembership、CreateShelfWithOwner、ListMembershipsByUser、JoinShelf等のDB操作。
- shelf/service.go: 名前の検証、ID/日時/招待コード生成、プロフィール確認、参加ルール、応答の組み立て。
- shelf/handler.go: JSONとパスの読取、contextにタイムアウトを付ける、service呼出、HTTP変換。
- shelf/access.go: RequireMember(ctx,shelfID,userID)を共通化。未認証はauth、未参加はここで拒否する。
- book: 既存model/handler/storeを修正して使う。必要になるまでserviceを追加しない。
- reading: model/handler/service/storeを作る。履歴・最新状態・再送判定の調整はservice、DBの同時保存はstore。

GinのContextをstoreへ渡さずcontext.Contextを渡す。DBクライアントはmainで一度生成し、構造体へ注入する。storeでpanicしない。テーブル名は環境変数から渡す。広範な汎用interfaceは作らず、テストで必要なDB操作だけを抽象化する。

## データの方式（未作成テーブルの案）
|論理テーブル|PK|SK|用途|
|---|---|---|---|
|Users（既存）|user_id|なし|プロフィール。既存のsnake_caseを維持|
|Shelves|shelfId|なし|name,createdBy,createdAt,inviteCode|
|ShelfMembers|shelfId|userId|role(owner/member),status(active),joinedAt|
|ShelfInvites（今回の追加案）|inviteCode|なし|shelfId,active,createdAt。コードから棚を引く|
|ShelfBooks|shelfId|bookId|本。既存ローカルテーブルのキーは実装前に確認|
|ReadingRecords|shelfId|recordKey|userId#bookIdごとの最新状態・version・finishedAt|
|ReadingPosts|shelfId|postKey|固定桁UTC日時#UUIDによる投稿履歴|
|RequestDedup|scopeKey|requestId|棚#本人#CREATE_POSTとIdempotency-Key、入力ハッシュ・初回応答|

ShelfMembersにuserId(PK)＋shelfId(SK)のGSIを作り、参加棚を検索する。GSIの結果は棚の存在と元テーブルのactive参加情報で再確認する。作成直後の一覧反映遅延は再取得で扱い、作成POSTを自動再送しない。

ShelfInvitesは旧ER図にはない追加案。招待コードにcrypto/randの16バイト以上を使い文字列化し、コードを主キーに条件付き保存する。棚作成時は棚・owner参加・招待の3件を同じトランザクションで保存する。最初は棚＋参加の2件から実装し、招待実装時に3件へ拡張してもよいが、フロントに返すinviteCodeは有効な招待データがある場合だけにする。

招待コードはGET棚詳細のownerにだけ返し、memberにはフィールドを省略する。参加APIは認証・プロフィール・コード有効性を確認し、active招待の条件確認とmember作成を同時実行する。既参加者をownerからmemberへ上書きしない。再参加は既存参加を確認して200。招待失効UIは後続だが、active=falseをGoで必ず拒否する。ログにトークンや招待コードを出さない。

保存モデルをそのままJSONへ返さず、応答型を作る。DBの内部キーや非owner向け招待コードを漏らさない。

## APIごとの処理設計
### 棚
- POST /api/shelves: JWT本人→Users存在確認→名前TrimSpace・1〜60コードポイント→UUID・UTC日時→原子的保存→201 ShelfDetail。
- GET /api/shelves/{shelfId}: active参加確認→棚・参加者一覧→Usersから表示名取得→ShelfDetail。membersは欠落なく集める（DBページングを無視しない）。
- GET /api/shelves: 本人の参加をGSI Query→棚とactive状態確認→items,nextCursor。結果0件でもcursorありなら続きがある。
- POST /api/shelves/join: コード検索→active確認→参加情報を条件付き保存→200 Shelf。userId/roleは入力から受け取らない。

### 本
- POST: 認証・棚参加確認→title 1〜200、authors 最大10人・各1〜100→UUID/現在日時/addedBy→保存→201 Book。
- GET: 認証・棚参加確認→棚IDをPKにQuery→items,nextCursor。Scanで全棚を読む方式はやめる。
- 未設定coverUrl/addedByはnull、authorsは[]。現在日時と成功応答を修正してからAWSで公開する。

### 読書
- POST: 棚参加と本存在→入力検証→重複排除照会→最新状態のversion確認→履歴・状態・重複排除を同時保存。
- 保存時にもメンバーactiveと本存在を条件確認し、確認から書込までの変更に備える。
- 同じキー・同じ内容は保存済みの同じ結果、違う内容は409。DBタイムアウトは保存済みの場合があるため新しいキーで勝手に再送しない。
- expectedVersion=0は未記録。更新ごとに+1。競合は409。finishedAtは読了時に更新し、再読中でも消さない。
- GET reading: JWT本人のrecordKeyプレフィックスで取得。API入力で他人の状態を上書きさせない。
- GET posts: 時刻降順6件、cursorあり。本と投稿者の表示情報を付加。投稿時のページや状態は後から変更しない。
- currentPageは*int32等でnullと0を区別。JSON応答でnullが必要な項目にomitemptyを付けない。commentはUnicode200文字以内、statusは3種限定。
- エラーコード/入力の厳密な検証と再送方式はfrontend-api-handoff.md/backend-plan.mdを参照。古いmeのエラー形状を今回まとめて変更しない。

## 起動・公開の進め方
当初は動いているLambda側のprotectedグループへ新ルートを追加する。大規模なmain.go整理を最初の必須作業にしない。ローカルの既存試作POSTが認証済みの公開APIと同じとは扱わない。

ローカルで同じ操作を検証するときは、接続設定のみ環境変数へ分離し、Cognitoの検証を維持して共通ルートを登録する。AWS_LAMBDA_RUNTIME_APIを手動で偽装して切り替えない。本人固定を使うならテスト内限定にする。

機能ごとにinfra/apiへテーブル、必要なDB操作と索引へのIAM、環境変数、JWT付きGatewayルート、Lambda呼出権限を追加。既存テーブルの置換・削除をplanで見つけたらそのままapplyしない。

CORSは公開元とlocalhostを許可。投稿開始時にIdempotency-Keyヘッダーを追加。フロントの公開フラグは全依存APIの確認後に有効化し再ビルドする。フラグは認可ではない。

## 検証とチェックポイント
- まずgo test ./...とgo vet ./...。DB結合試験は本番データと別のローカルテストテーブルを使う。
- 棚: 空名400、未認証401、非参加者403、作成時の棚/owner両方保存、失敗時片方だけ残らない。
- 招待: 無効コード拒否、同じ人2回で1参加、ownerを降格しない。
- 本: 空一覧[]、2冊保存、31冊以上のページ継続、他棚を読めない。
- 投稿: 120→180で旧履歴120、本人最新180、A/B分離、同じキー2回で1投稿、別本文409、同時更新409、不正ページ400。
- フロント: 初回0冊から追加できる、ネタバレ非表示時DOMに本文なし、保存失敗で見本へ切り替わらない。

起動中のbackendに対してプロジェクトルートで:
```powershell
docker compose exec -T backend go test ./...
docker compose exec -T backend go vet ./...
```
停止中ならexecの代わりに`docker compose run --rm --no-deps backend go test ./...`等を使う。Go編集後にbackendを再起動する。

## 今回決めたこと・残ること
- 実装順は上表。最初の新規Goファイルはshelf/model.go。
- 招待はコード方式、owner/memberの2権限。投稿者絞り込み・プロフィール編集は後回し。
- Usersの既存属性名を維持。新規レスポンスはフロント契約のcamelCaseへ合わせる。
- 実装ごとにapi.yamlとdevelopment-status.mdを更新し、実装済みと目標を混同しない。
- 実DBキー・本人のログイン確認・AWS配備は次の作業時に確認する。この資料の作成ではDB操作やデプロイをしていない。
