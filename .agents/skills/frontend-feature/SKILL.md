---
name: frontend-feature
description: 共同本棚のNext.js画面やAPI連携を追加・修正する際に、実APIとモックの区別を保って実装・検証する。
---
# フロントの変更
1. frontend/AGENTS.md、対象画面、docs/api.yaml、対応するGo受付処理を確認する。
2. 実装済みAPIだけで依頼された画面を作る。不足するAPIは依存事項として示す。
3. 実API画面と /mock のサンプルデータを分け、失敗時にモックへ切り替えない。
4. Next.jsの静的出力を保ち、読み込み・エラー・空状態とキーボード操作を確認する。
5. frontendで npm run typecheck、npm run build を実行し、表示も確認する。
Goの業務コードはこのSkillの対象外。変更結果と検証できなかった点を報告する。
