# 共同本棚・読書共有アプリ
Go講座の最終課題。Goは本人が学習しながら実装し、Next.jsフロントはCodexが担当しています。現在は開発環境と登録処理の試作段階です。

## 先生へ
- [実装状況・次の相談事項](docs/development-status.md)
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

8000はDB本体でWeb画面はありません。起動直後に503なら少し待って再確認してください。
停止は docker compose stop。Go編集後は docker compose restart backend。
bind mountは自動再起動ではありません。

## 登録の試作を確認する場合
疎通確認はテーブルなしでも成功します。登録の確認時だけ管理画面で次を作成します。
- Table name: Books
- Partition key: ShelfID（String）
- Sort key: BookID（String）

大文字小文字を区別します。現コードに合わせた試作テーブルで、将来案ShelfBooksとは異なります。
既存テーブルを削除して作り直さないでください。

以下は読取ではなく固定のshelf1/book1を書き込み、同じキーを上書きする操作です。
```powershell
Invoke-RestMethod http://localhost:8080/api/shelvs/shelf1/books
```
Booksで結果を確認してください。shelvsの綴りも現コードどおりです。
DBデータはdocker/dynamodbに保存されGitには含めません。AWSアカウントやAPIキーは不要で、localの認証情報はローカル専用ダミーです。

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
