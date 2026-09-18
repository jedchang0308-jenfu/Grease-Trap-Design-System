# DEV 任務總表｜油脂截留器雙軌計算系統

文件狀態：`DEV-023 Local Complete`

版本：`4.4`

最後更新：`2026-09-18`

## 總任務清單

- ✓ DEV-023 [交付點] [完成] [P1] [本機完成] 有效容積換算設計處理水量
  - 摘要：在正常建案入口新增 T06，輸入設備有效容積後依算法 A 換算設計處理水量。
  - 證據：ADR-011、SPEC-001、SPEC-002、QA-001、QC-001
  - 計入交付：是

- ✓ DEV-022 [交付點] [完成] [P1] [本機完成] 無核發流程的正式報告輸出
  - 摘要：任何使用者可直接產出正式報告，案件與報告共用編號。
  - 證據：ADR-010、QC-001
  - 計入交付：是

- ✓ DEV-021 [交付點] [完成] [P1] [已發版] Firebase Spark 純靜態 SPA 重構
  - 摘要：完成 Vite SPA、Anonymous Auth、Firestore 與靜態 Hosting。
  - 證據：ADR-009、QC-001
  - 計入交付：是

- ✓ DEV-012 [交付點] [完成] [P1] [已發版] Firebase production 發版
  - 摘要：已發布至專用 Firebase Spark project 並完成 production smoke。
  - 證據：QC-001
  - 計入交付：是

- ! DEV-011 [交付點] [阻塞] [P2] [等待人類資料] 真實案件平行試算
  - 摘要：以去識別案件比對人工結果與系統結果。
  - 阻塞：缺少 3～5 個去識別案件、人工結果、來源假設與可接受差異。
  - 計入交付：是

## Current

### DEV-023｜有效容積換算設計處理水量

狀態：`Complete Locally`

風險等級：`Medium`

執行邊界：本機程式、測試、規格與 UI 驗證；不部署、不修改 production 資料。

驗收標準：

- 建案頁新增「我知道設備有效容積，要換算設計處理水量」。
- 選取後只允許算法 A；schema 與 Firestore Rules 也拒絕其他模式。
- 工作台只要求有效容積與資料來源；`500 L` 顯示 `50 L/min`。
- 報告保留輸入、來源、`Qhour=6×Veff` 與 L/min 單位換算。
- targeted unit、typecheck、Rules integration、build 與 1440／390 UI QC 通過。

相關文件：ADR-011、SPEC-001、SPEC-002、QA-001、QC-001。

驗證結果：

| Gate                          | 狀態                              |
| ----------------------------- | --------------------------------- |
| typecheck                     | Passed                            |
| unit tests                    | Passed: 9 files / 41 tests        |
| Rules／repository integration | Passed: 1 file / 6 tests          |
| production static build       | Passed: 156 modules               |
| UI 1440／390                  | Passed: no overflow／visible error |
| report formula trace          | Passed: 500 L → 3000 L/h → 50 L/min |
| test data／browser cleanup    | Passed                            |

本變更尚未部署；既有 production release 仍為 DEV-012 所記錄版本。

### DEV-022｜無核發流程的正式報告輸出

狀態：`Complete Locally`

決策：任何使用者都可直接產出正式報告；不建立送審、覆核、核准、角色或核發狀態。草稿與正式報告沿用同一 snapshot，正式版直接使用案件編號 `GTC-YYMMDD-00` 與案件修訂版次。

已完成：

- 報告頁新增 primary CTA「產生正式報告」，既有動作改名為「產生草稿 PDF」。
- 尚未保存草稿時，正式報告動作會先保存當下 snapshot。
- 案件與正式報告共用 `GTC-YYMMDD-00`，已刪除 `RDR-` 轉換邏輯；檔名只附加 `RNN` 版次。
- 正式 PDF 移除草稿標記，封面與頁首顯示報告編號及版次。
- PDF 直接保存至使用者下載資料夾，成功後留在原頁顯示完整路徑。
- 報告「案件資料」改為緊湊的標籤／值排列；客戶、設置地點、需求目的與計算依據資訊完整保留，不再使用逐列大型表格。
- 報告標題改為實際文字章節編號：`1`～`4` 為主章，計算依據為 `2.1`／`4.1`，公式步驟延伸為 `4.1.1`。
- 新增 ADR-010，並同步 overview、SPEC、QA、QC、README 與文件地圖。

驗證狀態：

| Gate                               | 狀態                        |
| ---------------------------------- | --------------------------- |
| targeted format / lint / typecheck | Passed                      |
| unit tests                         | Passed: 9 files / 37 tests  |
| production static build            | Passed: 156 modules         |
| E2E 1440／1024／390                | Passed: 3 tests             |
| 正式 PDF                           | Passed: 4-page A4 visual QC |
| 實際地端產出                       | `GTC-260914-02-R01.pdf`     |
| temporary E2E runtime cleanup      | Passed: port 3210 released  |
| `git diff --check`                 | Passed                      |

本變更尚未部署；既有 production release 仍為 DEV-012 所記錄版本。

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
