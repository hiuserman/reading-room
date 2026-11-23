# 綴り：フロントの見本とAPI接続メモ
更新: 2026-11-22

`/mock`は架空データをメモリーに保持する操作見本。再読み込みでリセット。本当の登録・ログイン・DB保存は行わない。実API確認用の `/` と区別する。デプロイ設定は変更していない。

## 画面
- みんな: 投稿者IDで絞り込み、新しい記録から直近6件。タイトル・著者・日時・現在ページ・状態・ひとこと。
- 記録する: 本選択、reading/paused/finished、任意ページ、200コードポイント以内のひとこと、ネタバレ指定。ライブラリから開くと本人の最新状態を初期値にする。
- 本: 全冊検索、手入力追加、本人の読書状態と過去の読了実績。今は全データがメモリーにあるので全冊数を表示できる。
- プロフィール: 見本の表示名変更、記録数・読了冊数、架空のメンバー一覧。名前を変えてもuserIdは変わらない。
- 写真アップロード・ISBN取得・実認証・招待は未実装。背景と書影はCSSのオリジナル表現、書籍は架空。

## 後から接続するAPI（目標。実装済みではない）
実装済みの契約は `docs/api.yaml`、予定は `docs/backend-plan.md` を参照。

| 画面 | 予定API |
| --- | --- |
| 本人・プロフィール | GET /api/me |
| 棚とメンバー | GET /api/shelves/{shelfId} |
| 本一覧・登録 | GET / POST /api/shelves/{shelfId}/books |
| 投稿一覧・作成 | GET / POST /api/shelves/{shelfId}/posts |
| 本人の最新状態 | GET /api/shelves/{shelfId}/reading |
| 表示名変更 | PATCH /api/me（今回のUIからの追加提案、未確定） |

sample-data.tsのBook/ReadingPostは表示用の最小形。投稿時の入力はbookId,status,currentPage,comment,containsSpoilerとexpectedVersion、再送はIdempotency-Keyを使用する既存の目標設計を維持する。userId・postId・createdAtは本番ではサーバーが設定する。モックが生成する値を本人確認や本番保存に流用しない。
本一覧はitemsとnextCursorを最後まで取得してから全冊数・検索完了を表示する。取得失敗時にサンプルへ自動切替しない。投稿のcreatedAtはISO日時、画面ではAsia/Tokyoの日付・時刻として表示。
表紙URLは現在未使用。取得機能ができた時点で利用条件を確認して画像表示へ追加し、欠損時は今回のタイトル表現へ戻す。

## ユーザー管理の役割分担
Cognitoを採用する場合、登録・メール確認・ログイン・パスワード再設定はCognito。Usersはsub由来のuserIdと表示名等のアプリ情報、Shelvesは本棚、ShelfMembersは棚への参加とowner/member権限を保存する。Goは検証済みの本人情報とShelfMembersを確認する。
メールや表示名を永続キーにしない。誰でも登録できても、非参加者に本棚データは公開しない。Users作成＋初期棚＋owner参加は初回利用で再送に耐える処理にし、プロフィールや投稿を他人名義で更新できないようにする。
フロントのプロフィール見本はこの認証・権限処理ができたことを意味しない。
