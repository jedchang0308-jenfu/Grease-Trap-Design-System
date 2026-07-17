# ADR-009｜採 Firebase Spark 純靜態 SPA

狀態：Accepted / Implemented Locally

日期：2026-07-17

決策來源：使用者明確要求「純靜態 Firebase Spark 版本」

目標 Firebase project：`jenfu-grease-trap-calculator`，Web App nickname：`grease-trap-static-web`，Firestore `(default)` 位於 `asia-east1`，Spark plan。Storage 與 App Hosting 不建立。

## Context

同事試用需要低維運、公開連結與共享案件，不需要公司帳號、角色、後端正式簽核或 PDF 雲端留存。Firebase App Hosting 與 server runtime 會帶入計費及維運邊界，不符合 Spark 免費方案目標。

## Decision

採用 Vite + React + React Router 的 client-side SPA，部署至傳統 Firebase Hosting；Firebase Web SDK 只使用 Anonymous Authentication 與 Cloud Firestore。

- 網站啟動時自動 `signInAnonymously`，登入完成前不顯示案件與主要操作。
- 所有匿名使用者共用 `cases` collection。Firestore Rules 對未登入請求一律拒絕，對已登入匿名使用者開放受 schema 限制的共享讀寫。
- 計算核心、規則 catalog、report presentation 與 UI 全部在瀏覽器執行。
- 案件 create、calculate、revision 與 report draft 更新使用 Firestore transaction，並驗證 optimistic `version`。
- production build 只產生 `dist/`。Firebase Hosting 將所有 route rewrite 到 `/index.html`。
- 報告是案件內的草稿 snapshot。列印／另存 PDF 由瀏覽器執行，不上傳或保存 PDF。
- 舊 `ISSUED` 狀態只能唯讀顯示，不得由新版本建立。

## 不採用

- Firebase App Hosting、Cloud Run、Cloud Functions、Cloud Storage 與 Blaze 計費方案。
- Firebase Admin SDK、service account、server cookie、server session 與任何 `/api/*` business route。
- server-side PDF renderer、不可變正式報告保存及具後端可信度的正式核發。
- Email／Password、Google 登入、公司帳號與角色管理 UI。

## 已接受取捨

- 匿名 identity 不是公司身分驗證；網址外流者可能讀寫或刪除全部共享案件。
- 計算公式與規則會下載至瀏覽器，client 不是可信任執行環境。
- Firestore Rules 可限制 collection、欄位、型別與大小，但無法證明複雜 JSON payload 的工程語意正確。
- 報告草稿沒有正式簽核、不可變留存、後端時間戳或稽核保證。
- PDF 排版受瀏覽器、字型與列印設定影響，不保證跨瀏覽器像素一致。
- 不搬移舊正式資料。

## Consequences

- 可在 Spark 免費方案部署，但仍受 Authentication、Firestore 與 Hosting 免費額度及配額限制。
- UI 必須清楚處理匿名登入、permission denied、quota、network 與 transaction conflict。
- 文件與介面一律使用「報告草稿」「已匯出報告」，不得暗示正式核發。
- 未來若要恢復正式核發、敏感資料、公司身分、角色、不可變 PDF 或可稽核 actor，必須重新引入可信任後端並建立新 ADR、威脅模型與 release gate。

## Supersedes

本 ADR 取代 ADR-003 的 server Web 單體、ADR-005 的直接核發、ADR-007 的 Firebase 全端代管架構，以及 ADR-008 的 server session 存取方式。ADR-001、ADR-002 的雙軌計算語意及 ADR-004 的產品／證書排除仍有效，但報告出口改為草稿匯出。
