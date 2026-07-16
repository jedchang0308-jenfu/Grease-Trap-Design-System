# ADR-007｜採 Firebase 代管式多人協作架構

狀態：Accepted / Implemented Locally
日期：2026-07-17
決策來源：使用者要求先提交目前版本，再重構為建議的 Firebase 架構

## Context

系統的核心價值是計算正確，不以案件、稽核紀錄或已核發報告作為重要資產；未來仍需讓同事透過網路共同使用。既有 PostgreSQL、Docker／本機資料庫、migration、seed 與資料庫 trigger 帶來的維運成本，已高於目前資料治理需求。

## Options

- A：維持 Next.js、PostgreSQL、Docker／本機 PostgreSQL 與 seed identity。
- B：Next.js + Firebase Auth + Cloud Firestore + Cloud Storage + App Hosting，計算固定在 server-side domain service。
- C：純前端 Firebase，計算直接在瀏覽器執行。

## Decision

採 B。C 不採用，因為多人共同使用時，瀏覽器端計算與寫入不能成為計算正確性的唯一信任邊界。

## Chosen rule

- 保留 Next.js 模組化單體與既有純 TypeScript／Decimal 計算核心。
- Firebase Auth 負責內部帳號；server 以 Firebase Admin SDK 驗證 session cookie 與角色 claim。
- Cloud Firestore 保存案件、最新計算結果、覆核狀態與報告 metadata；不保存 SQL schema、migration 或 audit event stream。
- Cloud Storage 保存核發 PDF；PDF 仍只由 server-side snapshot 產生，不在瀏覽器重算。
- 所有 create、calculate、review、issue 與 download API 仍由 server 驗證身分及執行業務規則。
- 本機預設 `memory` adapter，讓 `npm run dev:local` 不依賴 Docker、PostgreSQL、Java 或雲端 credential；`dev:firebase` 才使用 Firebase Emulator Suite。
- production 必須使用 Firebase backend；不得以 memory adapter 啟動正式環境。
- 本輪不部署、不建立正式 Firebase project，也不搬移既有 PostgreSQL 資料；使用者已表明舊資料可捨棄。

## Consequences

- 本機啟動與自動化測試不再受 PostgreSQL／Docker 阻塞。
- Firestore transaction 只保護單一案件 aggregate 的版本與狀態轉換；不重建既有 SQL trigger 與完整 audit schema。
- 規則與來源 metadata 改由版本控制內的唯讀 TypeScript catalog 管理；計算 golden tests 是主要正確性 gate。
- 正式多人使用前仍需建立 Firebase project、設定 Auth provider／角色 claim、Firestore、Storage、App Hosting 環境變數及執行 release gate。
- Firebase Emulator 的 Firestore 元件需要本機 Java；沒有 Java 時仍可使用預設 memory 開發模式。

## Compatibility / migration impact

- 本 ADR 有意取代 ADR-003 的 PostgreSQL、provider-neutral persistence 與 seed identity 決策。
- 本 ADR 落實 ADR-006 的雲端內部存取目標，將 provider 固定為 Firebase；正式部署仍保留在 DEV-012 release gate。
- API URL、主要 UI 流程、公式、單位、raw／adopted 結果與 PDF 內容契約維持不變。
- 既有 `db/`、Docker Compose 與 PostgreSQL scripts 於 DEV-018 移除；基線 commit `bb1c675` 保留完整舊版。
