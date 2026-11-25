# 共同本棚・読書共有アプリ
now:開発環境

## 
- [現在のAPI仕様](docs/api.yaml)
- [要件](docs/requirements.md) / [構成図](docs/architecture.md) / [DB設計案](docs/data-model.md)
トップの / が実際の接続確認、/mock は将来UIの参考です。GitHubへのpushはソース共有でありWeb公開ではありません。

## 起動
GitとDocker Desktop（Linuxコンテナ）が必要です。ホストへのGo/Nodeインストールは不要。
cloneしたフォルダーで実行します。

```powershell
docker compose up -d --build
docker compose ps
Invoke-RestMethod http://localhost:8080/api/health
```

| URL | 用途 |
| --- | --- |
| http://localhost:3000/ | 実際の接続確認・開発状況 |
| http://localhost:3000/mock | 未接続のUIモック |
| http://localhost:8001/ | DB管理画面 |
| http://localhost:8080/api/health | Goの疎通確認 |

8000はDB本体でWeb画面はありません。healthはGoの応答確認のみでDB疎通を保証しません。
停止は docker compose stop。Go編集後は docker compose restart backend。
bind mountは自動再起動ではありません。

## 登録の試作を確認する場合
既存のShelfBooksを使います。キーはshelfId（String）とbookId（String）。既存テーブルを削除しないでください。
POST /api/shelves/1/books にtitle（文字列）とauthors（文字列配列）のJSONを送るとUUID付きで登録します。
現在は日時が固定、書名の必須チェックは未実装です。
一覧取得の関数はありますがGETルートはまだ未登録です。

/mock は提出用の投稿・ページ・状態・ネタバレ表示を操作できる見本。再読込でリセットされます。
[実装状況](docs/development-status.md)と[提出用要件](docs/requirements.md)を参照してください。
DB実データはGitに含みません。

## 検証
```powershell
docker compose run --rm --no-deps backend go vet ./...
docker compose run --rm --no-deps backend go test ./...
docker compose run --rm --no-deps backend go build ./...
docker compose run --rm --no-deps frontend npm run typecheck
docker compose run --rm --no-deps frontend npm run build
```
GitHub Actionsでも同種の検証を実行します。現時点でGoのテストケースは未追加、DB結合テストもありません。

## 開発の進め方
AGENTS.mdに担当範囲、.agents/skillsにfrontend-feature・api-contract-review・go-reviewを用意しています。
mainを共有基準にし、以後はfeature/機能名で小さく変更しPRで確認します。
個人用設定・DB実データ・秘密情報は共有しません。先生はclone後に上記手順で起動できます。

バックエンドの次の実装は[スマホUI対応の実装計画](docs/backend-plan.md)を参照。現行APIとは区別した目標契約です。
