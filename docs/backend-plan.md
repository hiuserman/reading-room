# スマホUIに対応するバックエンド実装計画
2026-11-17 ／ 目標契約。Goコード・DBは未変更。現状のAPIは [api.yaml](api.yaml)。

## 方針と範囲
Go＋Gin＋DynamoDBを維持。main.goは接続・ルート登録、handlerはHTTP、serviceは検証と業務処理、storeはDB操作に分ける。最初から汎用フレームワークや大量のinterfaceは作らない。
提出の第一到達点は固定棚 `1` とサーバー設定の `lesson-user` によるローカルデモ。クライアントから本人IDを指定させない。このモードをインターネットに公開しない。
本棚作成・招待UIは初期デモに不要。公開共同利用する段階で認証とメンバー認可を実装する。3人分の架空投稿を本番ユーザーと混同しない。

## 画面とAPI（すべて目標）
| 画面 | API | 役割 |
| --- | --- | --- |
| 共通ヘッダー | GET /api/me | userId, displayName。ローカルでは固定の本人 |
| 共通ヘッダー・投稿者フィルター | GET /api/shelves/{shelfId} | shelfId, name, members配列(userId, displayName) |
| みんな | GET /api/shelves/{shelfId}/posts?limit=6&userId=...&cursor=... | 最新順。userId省略で全員 |
| 本 | GET /api/shelves/{shelfId}/books?limit=30&cursor=... | 全冊をページ取得。bookId順で安定させる |
| 本を追加 | POST /api/shelves/{shelfId}/books | title, authorsから登録、201でBookを返す |
| 記録する・本 | GET /api/shelves/{shelfId}/reading?userId=...&cursor=... | 最新状態。省略時は本人。未記録はitemsに存在しない |
| 記録する | POST /api/shelves/{shelfId}/posts | 投稿履歴と最新状態を同時保存 |

本一覧の検索は、小規模な提出デモでは全ページ取得完了後にフロントでtitle/authorsを検索する。取得中は「全冊検索済み」と表示しない。サーバー検索・新着順索引は後続。
「本」の読了表示は本人のfinishedAtで判定。再読中でも過去の読了実績は残る。全員の読了者表示は後続にする。
投稿レスポンスにはbook（bookId,title,authors,coverUrl）とuser（userId,displayName）をGoで付加し、全冊取得が終わらなくてもカードを描画できるようにする。状態とページは投稿時点の値、本の表示情報は現在値。欠損時は「不明な本／ユーザー」の代替表示を返し、一覧全体を500にしない。

## JSON契約
Book: shelfId, bookId, title, authors（配列）, addedBy, createdAt, coverUrl（null可）。既存のaddedByなしデータはnullとして表示する。既存createdAtの正しい日時は推定しない。
一覧は `{ "items": [], "nextCursor": null }`。空配列をnullにしない。
ReadingRecord: shelfId, bookId, userId, status, currentPage, updatedAt, finishedAt（null可）, version。
Post: shelfId, postId, bookId, userId, status, currentPage, comment, containsSpoiler, createdAt, book, user。
日時はUTCのRFC3339、画面でローカル日時へ変換。深夜や別日の投稿は日付も表示する。API名はauthors/currentPage/containsSpoiler、モックのauthor/page/spoilerをそのままAPIにしない。

投稿入力例:
```json
{
  "bookId": "登録済みのUUID",
  "status": "reading",
  "currentPage": 120,
  "comment": "あと一章だけ。",
  "containsSpoiler": false,
  "expectedVersion": 0
}
```
`Idempotency-Key`ヘッダーには送信操作ごとのUUID。通信リトライは同じキー・同じ本文、新規操作は新しいキー。
成功201: `{ "post": { ... }, "readingRecord": { ... } }`。同一リクエスト再送も初回と同じ201・レスポンスを返す。

## 検証とエラー
- title: TrimSpace後1〜200 Unicodeコードポイント。authors: 省略時[]、最大10人、各1〜100コードポイント。
- status: reading / paused / finishedのみ。currentPage: nullまたは0〜2147483647の整数。省略はnull。ページ減少・再読は許可。
- comment: 省略は空文字、最大200 Unicodeコードポイント（Goはutf8.RuneCountInString）。フロントの文字数判定も合わせる。containsSpoilerは省略false。
- expectedVersion: 0以上の整数、必須。未記録は0。最新状態を取得して送る。
- JSON不正・未知フィールド・末尾の余分なJSON・本文32KiB超は拒否（サイズ超は413、その他400）。
- 本人・日時・IDはサーバー決定。本棚にないbookIdは404。認証なし401、非参加者403、version競合または同じキーで別本文は409。DB一時障害503、その他内部障害500。
- エラー形式は `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` に統一する計画。現行の文字列errorから変更するのでフロントも同時に対応。
- CORSはlocalhost:3000、GET/POST/OPTIONS、Content-Type/Idempotency-Key/Authorizationを許可。公開時は実配信元だけを許可。CORSは認証の代替ではない。

## 投稿トランザクション
1. 本人と棚の権限確認。RequestDedupを強い整合性で読み、同一キーの保存済み結果があれば本文ハッシュを照合して返す。
2. 本の存在、入力、ReadingRecordsのversionを確認。サーバーで投稿IDと日時を生成。
3. TransactWriteItemsでReadingPostsの新規Put、ReadingRecordsの条件付き更新、RequestDedupの条件付きPutを同時実行。公開版はactiveなShelfMembersと本の存在のConditionCheckも同じ取引に含める。
4. ReadingRecordsは未記録なら存在しない条件、更新ならversion一致条件。versionは+1。finished時はfinishedAtを今回日時に更新し、その他の状態では以前のfinishedAtを保持する。
5. 同時再送で競合したらRequestDedupを再読して同じ結果を返す。それがなければversion競合409。フロントは最新状態を再取得し、確認して新規送信する。勝手に上書きしない。
6. DB成功後に返信が途切れても再送で投稿を増やさない。DB障害で片方だけ保存しない。タイムアウトはコミット済みの可能性もあるため、成功不明時は同じキーで再送・結果照合し、未保存と断言しない。

重複排除レコードは提出版では自動削除せず保持する。TTLと保持期間は将来の運用課題。キーは棚・本人にスコープし、ハッシュは正規化した入力（expectedVersion含む）から作る。RequestDedupに初回のレスポンスを保存する。
DynamoDBのClientRequestTokenだけでは10分を超える再送を保証しないため、HTTPリトライの契約には上記レコードを使う。

## ページ取得
cursorはLastEvaluatedKeyと棚・フィルター・API種別・版を含む不透明文字列。Goでサイズ・形式・スコープを検証し、不正は400。cursorから別棚へアクセスさせない。各リクエストで権限を再確認する。
postsは既定6/最大30、books/readingは既定30/最大100。正の整数のみ。
投稿者絞り込みは棚をQueryした後のFilterExpression。DynamoDBのLimitは絞り込み前の件数なので、残り必要件数をLimitにして続きを取得し、指定件数または終端まで集める。1リクエスト最大10回のQueryで打ち切り、続きがあればcursorを返す。0件でもcursorがあれば終端ではない。フロントは最大6件または終端まで続きを取得する。
棚全体Scanは使わない。大規模化時は投稿者用GSIを検討する。追加中のページングはスナップショットではなく、UIでpostIdの重複を除く。

## Goファイル案（まだ作らない）
```text
App/
  main.go                    DB・Gin・ルート・ミドルウェア登録
  book/
    books.go                 Book型（既存を段階的に整理）
    handler.go               本のPOST/GET、HTTP入出力
    store.go                 PutItem/Query
  reading/
    model.go                 Post / ReadingRecord / 入出力型
    handler.go               postsとreadingのHTTP入出力
    service.go               検証、日時・ID、投稿保存の業務処理
    store.go                 QueryとTransactWriteItems
  shelf/
    handler.go               棚名・メンバー一覧
    store.go                 棚・メンバー取得
  middleware/
    cors.go                  許可元とOPTIONS
    identity.go              ローカル固定本人→公開時に認証へ交換
```
HTTPのcontextをstoreまで渡し、タイムアウト・キャンセルを伝播。storeでpanicせずerrorを返す。DB生成を各handlerで繰り返さない。

## 小さく実装する順番
| 期限の目安 | 作業 | 完了の目印 |
| --- | --- | --- |
| 11/17〜11/20 | 本GETルート・Query・ページング、POST検証・現在日時・201、CORS | 2冊登録→一覧→再読込で残る |
| 11/21〜11/24 | 新規テーブルと投稿POST、最新状態GET、トランザクション・再送 | 120→180ページの2投稿と最新180、競合・再送テスト成功 |
| 11/25〜11/28 | 投稿一覧・投稿者絞り込み、me/棚情報、フロントAPI接続 | 3タブが実データで動く。ネタバレ開閉 |
| 11/29〜12/1 | 共同公開が必要なら認証・認可とAWS配備 | 非参加者拒否、他人の状態は変更不可 |
| 12/2〜12/5 | 通しテスト・障害時表示・先生の環境で起動確認 | clone→起動→登録→投稿→再起動が通る |
| 12/6〜12/7 | 不具合修正・提出説明・デモ準備 | 機能追加を止める |

認証サービスとAWS公開の提出要否は未確定。この日程は目安。公開が必須なら早期にサービス選定し、ISBN検索より優先する。

## 必要なテスト
- handler: 正常系、空書名、不正状態、負数/小数ページ、201文字、JSON不正、異なる棚の本。
- DB結合（実データと別のテストテーブル）: 投稿と最新状態の同時保存、競合時に片方も残らない、同じキー2回で1投稿、同じキー別本文409。
- 一覧: 空配列、31冊以上、絞り込みで先頭ページ0件でも後続に結果、最終cursor=null。
- UI: 再読込後も保存、120→180でも過去投稿120、本人の読了表示、ネタバレ初期非表示、通信失敗の再送。
- 共同利用: Aの更新でBが変わらない、未認証/非参加者拒否。
- 各Go変更時にAppでgo test ./... / go vet ./...。フロント接続時はtypecheck / build。

## 参考（AWS公式）
- [Queryとフィルターのページング](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.Pagination.html)
- [TransactWriteItemsとClientRequestToken](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html)
