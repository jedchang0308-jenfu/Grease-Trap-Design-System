# Grease Trap Calculation System

鉦富機械使用的油脂截留器雙軌計算與設計計算書核發系統。

文件狀態：`Public Firebase Pilot Release In Progress`
文件版本：`3.1`
更新日期：`2026-07-17`

## 架構

- Next.js 提供 UI、API、身分驗證邊界與 server-side 計算。
- Decimal.js 計算核心與規則 catalog 均納入版本控制；瀏覽器與 PDF 不重算。
- 本機預設使用 local-file adapter，不需要 SQL、Docker、Java 或 Firebase credential。
- 多人試用環境固定使用 Firebase Anonymous Auth、Cloud Firestore、Cloud Storage 與 App Hosting；開啟網址後自動建立 session，不顯示帳密登入。
- Firestore／Storage client rules 預設拒絕直接存取，資料寫入只經過已驗證的 server API。

詳細決策見 [ADR-007](ai-doc/decisions/ADR-007-firebase-managed-architecture.md) 與 [ADR-008](ai-doc/decisions/ADR-008-public-link-anonymous-access.md)。

## 本機啟動

需求：Node.js 24+、npm。

```powershell
npm install
npx playwright install chromium
npm run dev:local
```

入口為 `http://localhost:3100`。本機案件資料保存於 `output/local-data/case-store.json`，重新啟動後仍會保留；核發 PDF 寫入 `output/pdf`。若要清空本機資料，可停止 dev server 後刪除 `output/local-data`。

## Firebase Emulator

只有需要驗證 Firebase adapter 時才使用 emulator；Firestore Emulator 額外需要 Java 21+。

```powershell
npm run dev:firebase
npm run test:firebase
```

`dev:firebase` 會啟動 Auth、Firestore、Storage Emulator，再啟動應用程式；公開模式會自動建立匿名身份。設定範本位於 [.env.example](.env.example)，不得提交正式 secret。

## 驗證

```powershell
npm run format:check
npm run test:all
npm audit
```

`test:all` 依序執行 lint、typecheck、單元測試、memory／local-file adapter 整合測試、production build，以及 1440／1024／390 三種 viewport 的 E2E。PDF 樣本可用 `npm run report:samples` 重建。

## 正式部署邊界

正式環境強制 `DATA_BACKEND=firestore` 與 `AUTH_BACKEND=firebase`。App Hosting backend 必須連結 Firebase Web App，讓平台注入 Web／Admin SDK 設定；Firebase Console 需啟用 Anonymous provider，不需建立使用者或 custom role claims。首版使用 `hosted.app` 網址，custom domain、舊資料搬移與角色控管不在本次範圍。

公開連結等同存取權：知道網址的人可讀寫與刪除共享案件，也可核發報告。首版不得放入不適合公開連結環境的敏感資料。

## 文件入口

1. [文件地圖](ai-doc/documentation_map.md)
2. [開發任務主控](ai-doc/dev_task.md)
3. [功能與工程主規格](ai-doc/specs/SPEC-001-functional-engineering.md)
4. [UI／UX 規格](ai-doc/specs/SPEC-002-ui-ux.md)
5. [QA 驗證計畫](ai-doc/qa/QA-001-validation-plan.md)
6. [本地 QC 紀錄](ai-doc/qa/QC-001-local-acceptance.md)

## 不可破壞的產品規則

- 兩份計算依據與五個客戶任務必須可獨立使用。
- 雙軌只要一軌有效即可預覽並核發；兩軌皆無有效結果時才阻擋。
- 不得跨軌借值、混用單位，或為未完成軌產生假結果。
- 正式比較與反推限制一律使用高精度 raw 值；報告採用值須明確標示。
- 系統只計算設計需求，不執行產品型號或證書匹配。
- 核發 PDF 必須由當下 snapshot 產生；報告保存不是法規稽核或長期資產需求。
