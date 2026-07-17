# QC-001｜本地 RD／QA／QC 驗收紀錄

文件狀態：`Conditional Pass - Public Firebase Release Target Pending`
版本：`2.4`
驗證日期：`2026-07-17`
適用範圍：本地計算、工作流、PDF、DEV-018 Firebase 架構與 DEV-012 公開匿名存取；不含正式 Firebase 部署

## 結論

本機 local-file 模式不依賴 SQL、Docker、Java 或雲端 credential，重啟後仍保留案件；memory 保留為測試隔離用 adapter。已通過格式、lint、型別、單元測試、application／memory／local-file 整合測試與本地瀏覽器主流程。未發現 P0／P1 defect。

計算正確性的最終人工作業證據仍待使用者提供 3～5 個去識別實際案件及既有人工預期值。DEV-012 已完成匿名 token／session 的聚焦單元驗證，但尚未建立本系統專用 Firebase project；本機也未安裝 Java，因此 Firebase Emulator integration 未執行。這些缺口不阻擋本機實作，但阻擋宣告公開網址已上線。

## DEV-018 重構事實

- 基線版本已提交於 `bb1c675`；重構在 `codex/firebase-refactor` 執行。
- PostgreSQL、migration、seed、Docker Compose 與資料庫啟動器已移除。
- `npm run dev:local` 直接啟動 Next.js 3100，健康檢查回傳 `dataBackend: local-file`，案件資料保存於 `output/local-data/case-store.json`。
- production 環境強制 Firestore 與 Firebase Auth，禁止 local-file／memory／local auth。
- Firestore 以單一案件 aggregate document 保存目前 revision、計算、評估與報告摘要；報告 snapshot 另存 `reports` collection。
- 第一版使用 Firebase Anonymous Auth；瀏覽器自動建立 session，無需同事帳號或 role claims，所有有效 session 共享案件與功能。
- Cloud Storage adapter 保存 PDF；本機 adapter 保存至 `output/pdf`，本機案件 metadata 保存至 `output/local-data`。
- 規則與來源 checksum 由版本控制內 catalog 提供，不再依賴 seed database。
- client rules 對 Firestore 與 Storage 預設 deny all；存取只經 server Admin SDK。

## 可重跑證據

| 門檻 | 指令 | 結果 |
| --- | --- | --- |
| 格式 | `npm run format:check` | 通過 |
| 程式品質 | `npm run lint`、`npm run typecheck` | 通過，0 warning／error |
| 單元測試 | `npm run test` | 10 files，33 tests passed |
| Application／memory／local-file 整合 | `npm run test:integration` | 2 files，10 tests passed |
| 正式建置 | `npm run build` | Next.js production build 通過 |
| 瀏覽器流程 | `npm run test:e2e` | 1440、1024、390；12 tests passed |
| Production artifact | standalone server／Playwright smoke | `/cases`、auth status、CSS、JS 皆 200；1440／390 無 overflow 或 console error |
| 依賴稽核 | `npm audit`／`npm audit --omit=dev` | 9／6 moderate；皆為 Firebase／Google Cloud transitive dependency，0 high／critical |
| Firebase Emulator | `npm run test:firebase` | 未執行：本機缺少 Java |
| 正式 Firebase | DEV-012 release gate | 未建立 project、未部署、未 smoke |

`npm audit fix --force` 會把 `firebase-admin` 降為不相容舊版，未採用。現有 advisory 位於 Google Cloud Storage 的 `uuid` 相依鏈；本系統未直接呼叫受影響的 UUID buffer API，但正式部署前仍須重跑 audit 並優先採用上游相容修正版。

## 計算與資料事實驗證

- 兩份計算依據的來源案例、內插、反推、嚴格比較、單位與捨入由獨立 expected values 的 unit tests 驗證。
- 雙軌任一有效軌可形成 `COMPLETE_WITH_REMINDER`；未完成軌不建立假 run 或 result。
- 規則 catalog checksum 與計算 core 共用於 local-file／memory／Firestore adapter，不因儲存技術改變公式。
- 計算請求具 idempotency；相同 key 與不同 payload 衝突、stale optimistic version 均回傳 409。
- 已核發狀態禁止重新計算；新修改以 revision 進行。Legacy 送審／覆核狀態資料相容為可重算或可核發，不再暴露覆核流程。
- PDF 由同一 snapshot 產生，整合測試驗證核發、讀回與重試不建立第二份報告。
- 不同 anonymous session 可讀取共享案件；刪除案件會刪除 report metadata 並最佳努力清除 PDF object。

## E2E 與負向路徑

- 三種 viewport 均完成「建案 → 雙軌計算 → 報告預覽 → 核發 → 下載」。
- 每個輸入欄位的說明入口、未登入 API 的安全 problem details、未登入 UI 的可恢復狀態均通過。
- 最終完整 E2E 共 12/12；無未預期 4xx／5xx、runtime error 或關鍵流程阻斷。前一輪行動版核發曾有一次 PDF 產製 500，同案重試、行動版 4/4 與完整 12/12 均通過；正式 smoke 仍需觀察核發穩定性。

## Gate 判定

| Gate | 判定 | 說明 |
| --- | --- | --- |
| 計算核心 | Pass | 33 unit tests 與來源 checksum 通過 |
| 工作流與 PDF | Pass | 10 integration、12 E2E、build 與 production artifact smoke 通過 |
| DEV-018 本地架構 | Pass | local-file default、memory test adapter 與 Firebase adapters 已完成 |
| Firebase Emulator | Not Run | 本機缺 Java；部署前需補驗證 |
| 真實案件平行試算 | Pending Human | 尚未收到 3～5 個去識別案例 |
| 正式 release | Not Run | 未建立 Firebase project 或部署 |

## Human Re-entry

1. 提供 3～5 個去識別實際案件、人工結果與可接受差異，完成計算正確性平行簽核。
2. 由 release owner 確認建立獨立 Firebase project 與可能的 Blaze billing，啟用 Anonymous Auth 後執行 staging／production smoke；不得沿用既有 PDM／ProJED project。
3. 若未來報告改列重要資產或需稽核，再新增保存期限、備份、復原與 immutable audit 契約。
