# Grease Trap Calculation System

鉦富機械內部使用的油脂截留器雙軌計算、工程覆核與設計計算書產生系統。

文件狀態：`Local Engineering Complete — Human Pilot Pending`  
文件版本：`2.0`  
建立日期：`2026-07-13`

## 本地啟動

需求：Node.js 24+、npm、Docker Desktop。

```powershell
npm install
npx playwright install chromium
npm run dev:local
```

固定入口為 `http://localhost:3100`。`dev:local` 會啟動本地 PostgreSQL、等待 healthy、依序執行 migration／seed／verify，再啟動 Next.js；port 3100 或 55432 被其他非本專案程序占用時會安全停止並說明原因。

環境變數範本位於 `.env.example`；不得提交正式 secret。development 預設使用具備全部內部角色的 seed identity，production 預設關閉 seed auth。

## 驗證

```powershell
npm run format:check
npm run test:all
npm audit
```

`test:all` 會執行 lint、typecheck、19 個單元測試、9 個 PostgreSQL 整合測試、production build，以及 1440／1024／390 三種 viewport 的 9 個 E2E 測試。四種 PDF 樣本可用 `npm run report:samples` 重建。

## 文件入口

1. AI／PM 冷啟動入口：[ai-doc/documentation_map.md](ai-doc/documentation_map.md)
2. 開發任務主控：[ai-doc/dev_task.md](ai-doc/dev_task.md)
3. 功能與工程主規格：[ai-doc/specs/SPEC-001-functional-engineering.md](ai-doc/specs/SPEC-001-functional-engineering.md)
4. UI／UX 規格：[ai-doc/specs/SPEC-002-ui-ux.md](ai-doc/specs/SPEC-002-ui-ux.md)
5. QA 驗證計畫：[ai-doc/qa/QA-001-validation-plan.md](ai-doc/qa/QA-001-validation-plan.md)
6. 本地 QC 紀錄：[ai-doc/qa/QC-001-local-acceptance.md](ai-doc/qa/QC-001-local-acceptance.md)

## 目前執行邊界

`DEV-001～005、DEV-007～010` 已完成，8 個有效產品交付點為 8／8。`DEV-011` 的自動化與本地 QC 已通過；仍待使用者提供 3～5 個去識別實際案件與人工結果，完成不可由 AI 假造的平行試算證據。

`DEV-012` 仍是 release gate：未選正式雲端 provider／Auth、未部署、未執行 production smoke。正式報告編號也留到首次 release 前由人類決定。

## 不可破壞的產品規則

- 現行 Q/G 與舊版 Q/V 均為第一階段正式功能。
- 五個客戶任務在兩軌都必須可獨立使用。
- 雙軌模式只要一軌有效即可覆核與核發；另一軌只作非阻擋提醒。
- 兩軌都無有效結果時才阻擋。
- 不得跨軌借值、混用單位或為未完成軌產生假結果。
- 系統只負責設計需求計算，不建置產品型號或證書匹配功能。
- 同一位已登入內部使用者可以完成編製、覆核與核發，所有動作仍須留存 audit。
- 第一版目標為雲端內部系統；正式 provider、Auth 與部署作業留到 release gate。
- 已核發報告必須以不可變快照重現。
