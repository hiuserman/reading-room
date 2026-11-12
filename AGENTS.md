# 共同本棚の開発方針
- Goバックエンドは利用者が学習しながら実装し、フロントはCodexが担当する。
- Goの説明・レビュー依頼では編集しない。実装変更は明示的に依頼された範囲で行う。
- 現状は docs/development-status.md と実コード、将来の要件は docs/requirements.md を参照する。矛盾を黙って埋めない。
- APIの実装済み仕様は docs/api.yaml。将来案を実装済みと扱わない。
- DBアクセスと業務ロジックはGoに集約。フロントは静的出力を維持する。
- 起動: docker compose up -d --build。Go編集後は backend を再起動。
- 検証: Appで go test ./... と go vet ./...、frontendで npm run typecheck と npm run build。
- DB実データ、秘密情報、生成バイナリはコミットしない。ローカル用ダミー認証情報は実認証と区別する。
- 変更理由・検証結果・未実装事項を日本語で説明する。
