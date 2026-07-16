# Grease Trap Calculation System

鉦富機械內部使用的油脂截留器雙軌計算、工程覆核與設計計算書產生系統。

文件狀態：`Local Engineering Complete — Human Pilot Pending`  
文件版本：`2.0`  
建立日期：`2026-07-13`

## 本地啟動

需求：Node.js 24+、npm，以及 PostgreSQL。

PostgreSQL 有兩種啟動方式：

- 預設：若本機有 PostgreSQL binaries，`npm run dev:local` 會自動在 `%LOCALAPPDATA%\GreaseTrapDesignSystem\postgres-data-18` 啟動專案專用 PostgreSQL，不需要 Docker。
- 備援：使用 Docker Desktop，由 `npm run dev:local` 自動啟動 `docker compose` 裡的 PostgreSQL。
- 不用 Docker：自行啟動 PostgreSQL，並在 `.env.local` 設定可連線的 `DATABASE_URL`。

```powershell
npm install
npx playwright install chromium
npm run dev:local
```

固定入口為 `http://localhost:3100`。`dev:local` 採用與隔壁 `AI_PDM` 相同的 Windows 啟動器模式：先準備資料庫，背景啟動 Next.js，等待 `/api/health`、`/`、`/cases` 通過後列出 `Local URL` 並開啟瀏覽器。若已有健康的本專案 3100 server，會直接沿用並開瀏覽器。

輔助指令：

```powershell
npm run dev:local:check
npm run dev:local:restart
```

`dev:local:check` 只檢查既有 3100 server；`dev:local:restart` 會停止本專案 stale process、清除 `.next-dev` 並重新啟動。若 port 3100 被非本專案程序占用，腳本只會列出 PID 與 command，不會未經確認就停止外部程序。

資料庫處理仍維持原規則：若目前 `DATABASE_URL` 連得上，就跳過 Docker，直接執行 migration／seed／verify；若連不上且使用預設本地 DB URL，會優先嘗試啟動專案專用 PostgreSQL；再不行才提示需要 Docker Desktop 或自行啟動 PostgreSQL。

Docker Compose 不使用固定容器名稱，由各工作目錄的 Compose project name 自動隔離。本專案預設 PostgreSQL host port 為 `55433`，避開舊版 `grease-trap-calculation-system` 常用的 `55432`。若另一個工作目錄已占用預設的 `55433`，請在未提交的 `.env.local` 同時設定其他 host port 與對應 URL，例如：

```dotenv
POSTGRES_PORT=55434
DATABASE_URL=postgresql://gtc:gtc_local_only@localhost:55434/gtc_dev
```

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

- 內政部給排水規範（附錄 5）與臺北市工務局衛工處設計說明均為第一階段正式計算依據。
- 五個客戶任務在兩軌都必須可獨立使用。
- 雙軌模式只要一軌有效即可覆核與核發；另一軌只作非阻擋提醒。
- 兩軌都無有效結果時才阻擋。
- 不得跨軌借值、混用單位或為未完成軌產生假結果。
- 系統只負責設計需求計算，不建置產品型號或證書匹配功能。
- 同一位已登入內部使用者可以完成編製、覆核與核發，所有動作仍須留存 audit。
- 第一版目標為雲端內部系統；正式 provider、Auth 與部署作業留到 release gate。
- 已核發報告必須以不可變快照重現。
