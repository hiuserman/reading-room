# 共同本棚 データ設計
版 0.4 ／ 2026-11-17 ／ 目標設計（DBの変更・移行はまだ実施しない）

![提出用ER図](diagrams/submission-er.svg)
[Mermaidソース](diagrams/submission-er.mmd)

## テーブル
キーはString。論理参照の整合性はGo側で検証する。ER図では複合主キーの両項目をPK表示し、各テーブルの2つ目のPK表示がDynamoDBのSKを示す（レンダラーは属性コメントを省略するため、正確なPK/SKは下表を参照）。authorsは文字列配列。
| テーブル | PK | SK | 主な属性 |
| --- | --- | --- | --- |
| Users | userId | なし | displayName |
| Shelves | shelfId | なし | name, createdBy, createdAt |
| ShelfMembers | shelfId | userId | role, status, joinedAt |
| ShelfBooks | shelfId | bookId | title, authors, createdAt, addedBy, isbn13?, coverUrl? |
| ReadingRecords | shelfId | recordKey | userId, bookId, status, currentPage, updatedAt, finishedAt?, version |
| ReadingPosts（追加） | shelfId | postKey | postId, bookId, userId, createdAt, status, currentPage, comment, containsSpoiler |
| RequestDedup（追加） | scopeKey | requestId | payloadHash, response（初回JSON）, createdAt |

scopeKeyはshelfId#userId#CREATE_POST。requestIdはIdempotency-Key。

recordKeyは userId#bookId。本人の状態一覧をshelfIdとbegins_with(recordKey, userId#)で取得する。postKeyは固定桁UTC日時（小数秒9桁）#UUID。可変桁RFC3339Nanoをそのまま並び順キーにしない。IDに区切り文字を含めない。
createdAtに統一する案（旧設計のaddedAtを改名）。現在コードは2023年の固定値のため、サーバー現在日時への修正が必要。既存データを無断で作り直さない。

## 最新状態と履歴
reading / paused / finished = 読書中 / サボり中 / 読了。未記録はレコードなし。現在ページはnullまたは0以上の整数。
総ページ数・割合・読書時間は持たせない。読了でも現在ページを自動推定しない。
ReadingRecordsは本・ユーザーごとの最新状態。ReadingPostsには投稿時点の状態とページをコピーし、後の更新で書き換えない。
読了時はfinishedAtを保存し、再読中・休止中にしても最後の読了日時は残す。全冊ライブラリの「あなたは読了済み」はこれを参照する。全員の読了者一覧は後続。
複数冊を同時に読書中にできる。本タブの初期版は本人の読了実績のみ表示する。

## 投稿の保存（実装予定）
POST /api/shelves/{shelfId}/posts で本人の投稿とReadingRecords更新をTransactWriteItemsで原子的に保存する。
Goは認証主体とactiveな棚メンバー、対象本の存在を検証する。userIdは本文から受け取らない。
expectedVersionで競合を検出。RequestDedupも同じトランザクションで保存し、同じIdempotency-Key・同じ本文は同じ結果を返す。異なる本文は409。提出版は自動削除なし。詳細は[backend-plan.md](backend-plan.md)。

## アクセス
- 投稿一覧: ReadingPostsをshelfIdでQuery、postKeyの降順、limit/cursorで取得。
- 全冊: ShelfBooksのshelfIdでQuery、bookId順。初期版は全ページ取得後にフロントでタイトル・著者を検索。
- 各人6冊の横棚は廃止。そのためのGSIは追加しない。投稿者フィルターはReadingPostsの棚Query＋フィルターとページ継続で対応。
- 参加棚: ShelfMembersのGSI(userId, shelfId)。権限判定は元テーブルで再確認。
- 最新状態: ReadingRecordsの棚Query＋recordKeyの本人プレフィックスで取得。現在の本一覧Scan試作は未ページ対応。
- フィルター後0件でもcursorがあれば終端ではない。総件数を推測しない。

## ネタバレ
containsSpoiler=trueのcommentは画面で初期非表示。開く操作まで本文DOMを作らない。再度隠せる。
これは意図しない閲覧を防ぐUIであり、権限分離や秘密情報の暗号化ではない。取得済みレスポンスには本文が含まれうる。
投稿自体は棚メンバーのみ閲覧可能。通知・検索スニペットに本文を露出しない。
写真、返信、リアクション用テーブルは今回は追加しない。

## 既存設計との差
旧版の現在ページ対象外・unread・アーカイブ必須の説明をこの提出用設計で置き換える。
旧 diagrams/data-model-*.mmd/svg/png、shelf-sharing-design.md は過去案として残す。現行のER図はsubmission-er。
公開時の認証・招待の具体方式は未決定で、図は認証実装済みを意味しない。

## 変更の適用
ReadingRecordsは未実装のため今回のキー変更は設計変更のみ。実DBに同名テーブルが既に存在する場合はキーを確認し、既存データを削除せず移行を別途計画する。ShelfBooksの既存キーは変更しない。RequestDedup以外のUsers/Shelves/ShelfMembersは固定ローカルデモでは設定値で代用できるが、公開時は永続化と認可が必要。
