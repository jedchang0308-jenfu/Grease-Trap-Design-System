# DEV 任務總表｜油脂截留器雙軌計算系統

文件狀態：`DEV-012 Production Release Complete`

版本：`4.2`

最後更新：`2026-07-17`

## Current

### DEV-021｜Firebase Spark 純靜態 SPA 重構

狀態：`Complete`

基線：`c5af308 chore: checkpoint public Firebase workflow`

目標：把 Next.js 全端版本改為可部署至傳統 Firebase Hosting 的 Vite + React SPA，只使用 Anonymous Auth 與 Firestore client access。

已完成：

- Vite、React Router 與 static `dist/` build。
- 自動匿名登入 gate；登入完成前不顯示案件或主要操作。
- Firestore client repository、strict document schema、transaction version／revision。
- 案件清單、建案、工作台、雙軌計算、刪除、修訂與動態 routes。
- 報告草稿 snapshot、隨站 Noto Sans TC、A4 print CSS、資產 ready gate 與瀏覽器列印／另存 PDF。
- Firestore Rules：未登入拒絕、已登入共享存取、collection／欄位／型別／長度限制。
- Hosting `dist` 與 SPA rewrite。
- 移除 server runtime、API Routes、Admin SDK、server session、Storage adapter 與 server PDF renderer。
- 新增 ADR-009，並同步 README、overview、SPEC、QA、QC 與文件地圖。

驗證狀態：

| Gate                                       | 狀態                |
| ------------------------------------------ | ------------------- |
| format check                               | Passed              |
| lint                                       | Passed              |
| typecheck                                  | Passed              |
| unit tests                                 | Passed: 35          |
| Firestore Rules／repository integration    | Passed: 5           |
| production static build                    | Passed: 155 modules |
| E2E 1440／1024／390                        | Passed: 3           |
| production source forbidden-pattern search | Passed              |
| `git diff --check`                         | Passed              |

Stop conditions：

- 不自行建立或修改 Firebase production project。
- 不啟用 Blaze 或任何計費。
- 不部署到既有 PDM／ProJED project。
- Java 缺失時可先完成不依賴 Emulator 的 gate，但 integration／E2E 不得誤報通過。

### DEV-012｜Firebase production 發版

狀態：`Complete`

發版證據：

- 目標：獨立 Firebase Spark project `jenfu-grease-trap-calculator`，未使用 PDM／ProJED。
- 網址：`https://jenfu-grease-trap-calculator.web.app`。
- release commit：`f0ccc1c refactor: ship static Firebase Spark SPA`。
- Hosting release：`1784302105130000`；version：`ca30cb18c51ffbae`。
- Firestore Rules 部署前已與本地內容完全相同，本次未重複發布 ruleset。
- production bundle SHA-256：`34d0577c23a41077d2383576abb54820219b8fb8115f8f6f5ab6564edf31e2d8`，線上與本地相同。
- post-deploy smoke：Anonymous Auth、Firestore 讀取、未登入 403、雙匿名 session、SPA routes、console／page error／overflow 全數通過。
- Hosting rollback 參考：前一 version `db5ac97927fc618a`；Rules rollback 參考 ruleset `301e841c-e32b-47a7-842c-e8e237964914`。

### DEV-011｜真實案件平行試算

狀態：`Pending Human`

恢復條件：提供 3～5 個去識別案件、人工結果、來源假設與可接受差異。不得以 UI 看似合理取代工程結果比對。

## Completed / Historical

| DEV          | 結果                                                          |
| ------------ | ------------------------------------------------------------- |
| DEV-001～005 | 專案骨架、規則來源、雙軌計算核心與 orchestrator 完成          |
| DEV-006      | 依 ADR-004 取消產品／證書匹配                                 |
| DEV-007      | 案件清單、精靈與計算工作台完成                                |
| DEV-008      | 舊覆核流程已由一人作業及 ADR-009 取代                         |
| DEV-009      | 舊 PDF production 已移除；現行為 report draft + browser print |
| DEV-010      | unit、integration、E2E 與 UI QC 基礎建立                      |
| DEV-013～017 | 建案資料、報告資訊、來源分類與 CTA 調整完成                   |
| DEV-018～020 | Firebase 過渡架構與一人作業；現已由 DEV-021 取代 runtime 部分 |

歷史實作細節由 git baseline 與 ADR 決策鏈保存，不得將已取代的 server、session、Storage 或正式核發流程當成 active contract。
