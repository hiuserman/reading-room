---
name: api-contract-review
description: GoとNext.jsのURL・メソッド・JSON・CORSの不一致を読み取り専用で確認する。
---
# API契約レビュー
docs/api.yaml、App/main.go、App/book、対象フロントを比較する。設計案と現状を区別する。
URL・メソッド・JSON項目・エラー・CORSを確認し、場所、期待値、実際、修正の考え方を報告する。
GETにも書込み試作があるため無断で実行しない。レビューではソースと契約を編集しない。
