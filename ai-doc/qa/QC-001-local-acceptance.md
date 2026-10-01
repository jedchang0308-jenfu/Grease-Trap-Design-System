# QC-001｜Firebase Spark 純靜態版本本機驗收

文件狀態：`Production Release Passed / Local Delta Passed`

版本：`3.3`

日期：`2026-10-01`

## 結論

Vite SPA、Anonymous Auth gate、Firestore client repository、strict Rules、報告草稿與無核發流程的正式報告輸出已完成。DEV-023 已在本機新增有效容積換算設計處理水量任務，並於獨立 Firebase Spark project `jenfu-grease-trap-calculator` 完成 production smoke；正式 Hosting 以瀏覽器列印 fallback 輸出 PDF。

## DEV-023 驗證結果

- 建案頁顯示第六個情境「我知道設備有效容積，要換算設計處理水量」。
- 選取 T06 後只有算法 A；client schema 與 Firestore Rules 都拒絕算法 B／雙軌。
- 工作台只顯示設備有效容積與資料來源兩個輸入欄位。
- `500 L` 實際顯示 `50 L/min`；結果表不顯示不適用的「設備所需有效容積」列。
- 報告草稿包含有效容積、資料來源、`Qhour=6×Veff`、`3000 L/h` 與 `Qminute=Qhour/60`、`50 L/min`。
- Playwright 於 1440×900 與 390×844 操作正常入口；root 與報告 iframe 水平溢出皆為 0，console error 與可見 alert 皆為 0。
- QC 建立的 `DEV-023 UI QC` 測試案件已精確刪除；Playwright 測試瀏覽器已關閉。

| DEV-023 Gate                   | 結果 | 證據                                             |
| ------------------------------ | ---- | ------------------------------------------------ |
| targeted format                | PASS | 本次程式與測試檔案符合 Prettier                  |
| typecheck                      | PASS | `tsc --noEmit`                                   |
| unit                           | PASS | 9 files / 41 tests                               |
| Rules／repository integration  | PASS | 隔離 emulator；1 file / 6 tests                  |
| production static build        | PASS | Vite；156 modules；static `dist/`                 |
| UI delivery path               | PASS | 建案 → T06 → 算法 A → 500 L → 50 L/min → 報告   |
| UI 1440×900／390×844           | PASS | 無 overflow、重疊、visible error 或 console error |
| `git diff --check`             | PASS | 無 whitespace error                              |

全專案 `format:check` 仍命中本輪開始前已存在的 `src/ui/report/report-preview.tsx` 與 `tests/e2e/full-workflow.spec.ts` 格式差異；全專案 ESLint 仍是既有 4 個 `react-hooks/set-state-in-effect` 診斷。本次未為了 DEV-023 改寫這些他人／既有變更。

## 已確認事實

- 基線已提交：`c5af308 chore: checkpoint public Firebase workflow`。
- production framework 已由 Next.js 改為 Vite + React Router。
- `firebase.json` public 為 `dist`，`**` rewrite `/index.html`。
- Firebase Web SDK 只使用 Authentication 與 Firestore。
- 未登入 Rules 拒絕、已登入匿名使用者可依 strict schema 存取共享 `cases`。
- create、calculate、revision 與 report draft 使用 client transaction／version。
- 報告保存案件內 snapshot；正式報告與草稿使用同一 snapshot，不建立送審、覆核、核准或核發狀態。
- 案件與正式報告直接共用 `GTC-YYMMDD-00`，沒有第二套前綴、轉換或流水號邏輯；版次沿用案件修訂號。
- 報告 HTML 使用專案內建的 Noto Sans TC 字型檔；本機 renderer 或正式環境瀏覽器列印流程都等待字型與圖片完成載入。
- 報告預覽的案件資料採緊湊標籤／值排列；案件、客戶、設置地點、本次計算任務與算法依據均保留。
- 建案、案件清單及案件摘要均以「計算任務」稱呼使用者選擇的計算類型；報告使用「本次計算任務」與「參考計算」描述範圍。
- 報告章節編號以實際文字呈現，主章、方法與公式步驟可讀為 `1`、`2.1`、`4.1.1` 等階層。
- UI 使用「產生草稿 PDF」「產生正式報告」，正式報告為 primary action；舊 `ISSUED` 仍唯讀。
- 本機 PDF helper 只掛載 Vite dev／preview middleware；正式 Hosting 使用瀏覽器列印 fallback，`dist/` 不含 server bundle、Admin SDK、session 或 Storage adapter。

## Gate 結果

| Gate                            | 結果 | 證據                                      |
| ------------------------------- | ---- | ----------------------------------------- |
| format check                    | PASS | Prettier matched files                    |
| lint（本次報告 delta）          | PASS | 目標檔案 0 error / 0 warning              |
| typecheck                       | PASS | `tsc --noEmit`                            |
| unit                            | PASS | 9 files / 37 tests                        |
| Rules／repository integration   | PASS | 1 file / 5 tests                          |
| static build                    | PASS | Vite；156 modules；static `dist/`         |
| E2E                             | PASS | 1440、1024、390 共 3 tests                |
| 正式報告 PDF                    | PASS | `GTC-260914-02-R01.pdf`；4 頁 A4          |
| `dist`／source forbidden search | PASS | 無 server bundle 或禁用 runtime           |
| production dependency audit     | PASS | 0 vulnerabilities                         |
| Hosting deploy                  | PASS | release `1789719635265000`                |
| production artifact provenance  | PASS | live asset 與本地 production build 對應   |
| production smoke                | PASS | Auth、Firestore、routes、T06、列印提示、console |
| `git diff --check`              | PASS | 最終重跑                                  |

E2E 已驗證自動匿名登入、建案、輸入編輯、雙軌計算、report preview、snapshot export、草稿 PDF、正式 PDF、第二匿名 session、case/report route reload 及 revision +1。每個 viewport 均驗證 root overflow 與 critical console/page error。

本機正式 PDF 實際輸出為 4 頁、每頁 `594.96 x 841.92 pt` A4；正式 Hosting smoke 驗證 `500 L → 50 L/min`、`3,000 L/h`、正式報告 HTML 與瀏覽器列印提示，console/page error 為 0。

## 已知風險

- 匿名登入不驗證公司身分，網址外流者可讀寫共享案件。
- Rules 只驗證 JSON envelope；複雜工程內容由 client schema 驗證，無可信任後端。
- 正式報告由匿名使用者直接產出，沒有正式簽核、核發流程、不可變留存或 actor 真實身分保證。
- 全專案 ESLint 仍有 4 個既存 `react-hooks/set-state-in-effect` 診斷，位於案件、清單、建案與規則頁；本次報告 delta 的目標檔案為 0 error。
- 內建字型、字型／圖片 ready gate 與 A4 print CSS 已降低不同電腦的排版差異；但 browser print 仍不保證不同瀏覽器列印引擎、頁邊設定或縮放選項下像素完全一致。
- production JS chunk 約 1,037 kB（gzip 約 314 kB）；Vite 發出 chunk size warning，後續可評估 route/vendor splitting。
- 完整 `npm audit` 有 5 個 moderate，全部來自 dev-only `firebase-tools` 的 OpenTelemetry／uuid 相依鏈；`npm audit --omit=dev` 為 0。`npm audit fix --force` 會降級 firebase-tools，未採用。
- integration／E2E 使用暫存目錄內官方 Temurin JRE 21.0.11；它不是專案 dependency，也未修改系統 Java 安裝。

## Production Release

- URL：`https://jenfu-grease-trap-calculator.web.app`。
- release commits：`69b25ba`、`b27933e`、`313e83e`；Hosting version：`b80619292330c218`；release：`1789719635265000`。
- 未登入 Firestore 讀取為 403；兩個不同匿名 session 皆可讀取共享案件。
- `/cases`、`/cases/new`、任意 case ID 與 report URL 皆由 Hosting SPA rewrite 回應 200。
- post-deploy browser smoke 的 console error、page error 與 T06／正式報告列印 fallback 驗證通過；disposable smoke case 已刪除。
- rollback：Hosting 前一 version `ca30cb18c51ffbae`；Rules rollback 依 Firebase release history。
