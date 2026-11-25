# 完成形フロントからGoへの接続契約

2026-11-24。フロントを先に完成形へ整えるための引き継ぎです。**本棚・本・投稿の以下の契約は提案であり、実装済みAPIではありません。Go・DB・AWSリソースはこの変更で追加していません。**

実APIクライアントは `frontend/lib/reading-api.ts`。既存の `/api/me` 以外は、ビルド時の `NEXT_PUBLIC_READING_API_ENABLED=true` がないと通信しません。通常は未設定（無効）のまま配信してください。画面が完成しても、保存や参加ができたことにはしません。

## 既存API

| API | 入力 | 正常レスポンス |
| --- | --- | --- |
| GET /api/me | Bearerアクセストークン | 200 `{user_id, display_name, created_at}` |
| POST /api/me | `{display_name}` | 201 同上 |

Usersは実装済みのsnake_caseを維持します。フロントはこの応答を画面の本人情報へ変換します。GETの404は、現在のGoが返す `{ "error": "プロフィールが未登録です" }` のときだけ初回登録へ進めます。API Gatewayの404と混同しません。POSTの409は再取得を案内します。

## 未実装APIの目標

全ルートでJWTを検証します。棚配下の読み書きは、その都度、本人のactiveな参加権限をGoで確認します。入力のuserIdに権限を委ねません。

| API | 入力・取得条件 | 応答 |
| --- | --- | --- |
| GET /api/shelves | limit=30, cursor | Page&lt;Shelf&gt;（参加棚のみ） |
| POST /api/shelves | `{name}` | 201 ShelfDetail。棚と作成者の参加を同時保存 |
| POST /api/shelves/join | `{inviteCode}` | 200 Shelf。同じ本人の再参加は重複させない |
| GET /api/shelves/{shelfId} | 棚への参加が必要 | ShelfDetail |
| GET /api/shelves/{shelfId}/books | limit=30, cursor | Page&lt;Book&gt; |
| POST /api/shelves/{shelfId}/books | `{title, authors: []}` | 201 Book |
| GET /api/shelves/{shelfId}/posts | limit=6, cursor、時刻降順 | Page&lt;Post&gt; |
| POST /api/shelves/{shelfId}/posts | PostInput＋Idempotency-Key | 201 `{post, readingRecord}` |
| GET /api/shelves/{shelfId}/reading | limit=30, cursor、JWT本人分のみ | Page&lt;ReadingRecord&gt; |

棚作成・招待参加は今回のフロント先行契約です。以前の固定棚・固定本人のローカル案から、誰でも登録して利用開始できる導線へ変更しています。コードの具体形式・発行／失効方法はGo実装時に決めてください。推測しにくいコードをサーバーで発行し、ownerだけに開示します。招待コードを知っている認証済みユーザーが参加できる方式です。

## 応答の型

```ts
type ReadingStatus = "reading" | "paused" | "finished";
type Shelf = { shelfId: string; name: string };
type Member = { userId: string; displayName: string };
type ShelfDetail = Shelf & { members: Member[]; inviteCode?: string };
type Book = {
  shelfId: string; bookId: string; title: string; authors: string[];
  addedBy: string | null; createdAt: string; coverUrl: string | null;
};
type ReadingRecord = {
  shelfId: string; bookId: string; userId: string; status: ReadingStatus;
  currentPage: number | null; updatedAt: string; finishedAt: string | null;
  version: number;
};
type Post = {
  shelfId: string; postId: string; bookId: string; userId: string;
  status: ReadingStatus; currentPage: number | null; comment: string;
  containsSpoiler: boolean; createdAt: string;
  book: { bookId: string; title: string; authors: string[]; coverUrl: string | null };
  user: Member;
};
type Page<T> = { items: T[]; nextCursor: string | null };
type PostInput = {
  bookId: string; status: ReadingStatus; currentPage: number | null;
  comment: string; containsSpoiler: boolean; expectedVersion: number;
};
```

- 日時はUTCのRFC3339。nullの項目を省略しない。空の一覧は`items: []`、終端は`nextCursor: null`。
- 古い本の追加者が分からなければ`addedBy: null`。書影なしは`coverUrl: null`。作者なしは`authors: []`。
- ID・本人・投稿日時はサーバーで生成・決定します。投稿一覧には本・投稿者の表示情報をGoが付加します。
- 最新状態は本人／本ごと。投稿は当時の状態・ページを保存し、過去投稿を後から書き換えません。
- `finishedAt`は最後の読了実績で、再読中に戻しても保持します。読了実績を直近6投稿だけから計算しません。
- ページはnullまたは0〜2147483647の整数、状態は上記3種、ひとことは200 Unicodeコードポイント以内。入力上限はGoでも検証します。
- 同じ操作の再送は同じIdempotency-Key・同じPostInput。競合時409。投稿・最新状態・再送判定用レコードは既存設計のトランザクションで保存します。
- ShelfBooksの実際のキーを確認してQueryを使用し、cursorを別棚のアクセスに悪用できないようGoで検証します。

エラーは既存の `{error: "..."}` と将来の `{error: {code, message}}` をクライアントで受け取れます。画面は任意の内部エラー文字列を表示せず、HTTPコードごとの案内に変換します。401は再ログイン、403は参加先確認、409は最新情報の再取得。保存通信の失敗を「未保存」と断定しません。

## AWS接続を有効にする前の確認

1. 認証済みの実アカウントで `/api/me` の取得・登録・再読込を確認する。
2. 上記Goルート、本棚の認可、入力検証、DynamoDBテーブル、Lambdaのテーブル名環境変数と最小IAM権限を追加する。
3. API Gatewayに上記ルートとJWT authorizerを追加し、Lambda呼出権限も許可する。healthの公開設定を業務APIへコピーしない。
4. CORSはCloudFrontの配信元を許可し、GET/POST、Authorization/Content-Type/**Idempotency-Key**を許可する。ブラウザーのプリフライトも確認する。
5. 2ユーザー・未参加者で登録、参加、本登録、投稿、読書状態分離、再送、リロード永続化を確認する。
6. 公開API URLとCognito設定を指定し、`NEXT_PUBLIC_READING_API_ENABLED=true` を設定して静的ビルド・再配信する。Composeのlocalhost用API URLは公開ビルド時に明示上書きする。

フラグはNext.jsビルド時に埋め込まれます。配信後のS3環境変数変更で切り替わるものではありません。このフラグは公開準備の切り替えであり、セキュリティ境界はGoとAPI Gatewayです。
