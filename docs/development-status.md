# 実装状況（2026-11-12）
- / : 実API経由のDB疎通確認。/mock : ブラウザー内サンプル、再読込で初期化。
- GET /api/health : ListTablesで200または503。
- GET /api/shelvs/{shelfID}/books : 登録試作。URLと本文は未使用。Booksへ固定shelf1/book1を書込み。同じキーは上書き。
- MarshalMapにはdynamodbavタグがないので、属性名はShelfID/BookID。設計案ShelfBooksとは異なる。
- 一覧・ISBN検索・状態共有・認証・AWS配備は未完成。
- Goテストケースは未追加。CIはビルド等を確認するが、DB結合テストではない。
