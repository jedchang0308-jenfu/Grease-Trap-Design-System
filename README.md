# 油脂截留器雙軌計算系統

本專案是 Vite + React 的純靜態 SPA，部署目標為 Firebase Spark 免費方案的傳統 Firebase Hosting。瀏覽器使用 Firebase Anonymous Auth 自動登入，並直接透過 Firebase Web SDK 存取 Cloud Firestore。

> 安全提醒：匿名登入不是公司身分驗證。任何取得網址的人都可能讀取、建立、修改或刪除共享案件。請勿輸入不適合公開連結環境的個資、機密或敏感資料。

## 功能

- 案件清單、建立案件、案件刪除與修訂。
- 內政部給排水規範（附錄 5）Q/G 計算。
- 臺北市工務局衛工處設計說明 Q/V 計算。
- 單軌或雙軌計算、完整性提醒與設計結果。
- 報告草稿預覽、案件內 snapshot、草稿／正式 PDF 與隨站 Noto Sans TC；正式 Hosting 由瀏覽器列印／另存為 PDF。
- `/cases`、`/cases/new`、`/cases/:id`、`/cases/:id/report` 直接開啟與重新整理。

任何使用者都可直接產出正式報告，不需要送審、覆核或核發權限。正式報告直接沿用案件編號 `GTC-YYMMDD-00`，不建立第二套報告編碼；版次使用案件修訂號。本版本不提供正式簽核、核發流程或不可變稽核鏈；舊 `ISSUED` 資料只作唯讀歷史狀態相容。

## 架構

```text
Browser
  -> Firebase Anonymous Auth
  -> React Router SPA
  -> TypeScript / Decimal.js calculation core
  -> Firestore Web SDK transaction
  -> report snapshot + HTML preview
  -> local PDF renderer or browser print / Save as PDF
```

production build 只產生 `dist/` 靜態檔案。專案不使用 server runtime、Firebase Admin SDK、Cloud Functions、Cloud Run、Cloud Storage 或 Firebase App Hosting。

## 本機需求

- Node.js 24 或更新版本
- npm
- Java 21 或更新版本：只有 Firestore Emulator、integration 與 E2E 需要

安裝：

```powershell
npm ci
```

使用 Firebase Emulator Suite 啟動本機環境：

```powershell
npm run dev:local
```

開啟 `http://127.0.0.1:3100/cases`。Emulator 使用 `demo-grease-trap`，不會連線或寫入任何正式 Firebase project。

### 已有本機 runtime 時

`dev:local` 預設使用 Auth `9099`、Firestore `8080`、Emulator UI `4000` 與 Vite `3100`。若同專案的 Firebase Emulator Hub 已在執行，指令會重用 Auth／Firestore；本系統頁面也已在 `3100` 時，指令會回報既有網址並正常結束。若 Emulator 埠被占用，啟動器會從預設埠往後尋找可用埠，並輸出實際配置；Vite 維持使用 `3100`。若無法確認 `3100` 上的服務屬於本專案，指令會列出 PID 與程序名稱並停止，不會自動停止任何程序。

唯讀檢查埠號與服務：

```powershell
netstat -ano | Select-String ':(8080|8081|9099|9100|3100|4000|4001|4400|4401|4500|4501)\s'
# 若 Auth 使用替代埠，將 9099 換成啟動器輸出的實際埠號。
Invoke-WebRequest http://127.0.0.1:9099/emulator/v1/projects/demo-grease-trap/config
Invoke-WebRequest http://127.0.0.1:3100/
```

若要重啟，先確認 PID 屬於本專案的 runtime，再明確停止該 process tree；不要直接終止未知或其他專案的行程。

## Firebase Web 設定

複製 `.env.example` 的欄位到 `.env.local`，填入新 Firebase Web App 的公開設定：

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_USE_FIREBASE_EMULATORS=false
```

Firebase Web config 不是秘密，但不得放入 service account、private key 或 Admin credential。

## 品質檢查

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run build
npm run test:e2e
git diff --check
```

`test:integration` 驗證 Firestore repository 與 Rules；`test:e2e` 以 Auth／Firestore Emulator 啟動 production static preview，並執行 1440、1024、390 viewport 流程。

## Firebase 部署

只能建立本系統專用的新 Firebase project，不得使用既有 PDM 或 ProJED project。

正式環境：[https://jenfu-grease-trap-calculator.web.app](https://jenfu-grease-trap-calculator.web.app)

本輪設定目標：

- Project ID：`jenfu-grease-trap-calculator`
- Web App nickname：`grease-trap-static-web`
- Plan：Spark
- Firestore database：`(default)` / `asia-east1` / Production mode
- Storage、App Hosting：不建立

1. Firebase Console 啟用 Authentication 的 Anonymous provider。
2. 建立 Cloud Firestore database。
3. 建立 Web App 並設定 `.env.local`。
4. 確認 `.firebaserc` 指向 `jenfu-grease-trap-calculator`。
5. 先部署 Firestore Rules：`firebase deploy --only firestore:rules`。
6. 執行 `npm run build`。
7. 部署純靜態 Hosting：`firebase deploy --only hosting`。

`firebase.json` 的 Hosting public 目錄為 `dist`，所有應用路徑 rewrite 至 `/index.html`。系統已部署至獨立 Spark project `jenfu-grease-trap-calculator`；2026-09-22 發布 commit `2e1d261` 的 Rules／Hosting。未啟用 Blaze、Storage、Functions 或 App Hosting。

正式 Hosting 不提供 server runtime；報告 PDF 由瀏覽器列印視窗另存。`/api/report-pdf` 僅供 E2E 的本機 Vite preview 使用，不進入 production bundle。

## 文件

- [文件地圖](ai-doc/documentation_map.md)
- [專案總覽](ai-doc/project_overview.md)
- [功能與工程規格](ai-doc/specs/SPEC-001-functional-engineering.md)
- [UI／UX 規格](ai-doc/specs/SPEC-002-ui-ux.md)
- [驗證計畫](ai-doc/qa/QA-001-validation-plan.md)
- [ADR-009：Spark 純靜態 Firebase 架構](ai-doc/decisions/ADR-009-static-firebase-spark-spa.md)
- [ADR-010：直接產出正式報告](ai-doc/decisions/ADR-010-direct-formal-report-output.md)
