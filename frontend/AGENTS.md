# フロントエンド
- Next.js App Router・TypeScript・既存CSSを使う。output: export を維持する。
- / は実APIの接続と開発状況の確認、/mock は未接続のUI参考。
- モックデータを実データの代わりとして黙って表示しない。
- docs/api.yaml とGoコードを照合する。未実装APIを作り上げない。
- GoコードやAPI契約の変更が必要なら理由を示し、利用者の実装範囲を尊重する。
- 読込中・成功・空・エラーを扱い、フォームのラベルとキーボード操作を確認する。
- npm run typecheck と npm run build で検証。lintスクリプトは現在ない。
