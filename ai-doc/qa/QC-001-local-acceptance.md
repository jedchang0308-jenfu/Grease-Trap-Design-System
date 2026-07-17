# QC-001｜Firebase Spark 純靜態版本本機驗收

文件狀態：`Production Release Passed`

版本：`3.0`

日期：`2026-07-17`

## 結論

Vite SPA、Anonymous Auth gate、Firestore client repository、strict Rules、report draft、browser print 與 Hosting static config 已完成。本機 gate、production artifact 與部署後 smoke 全部通過；已發布至獨立 Firebase Spark project `jenfu-grease-trap-calculator`。

## 已確認事實

- 基線已提交：`c5af308 chore: checkpoint public Firebase workflow`。
- production framework 已由 Next.js 改為 Vite + React Router。
- `firebase.json` public 為 `dist`，`**` rewrite `/index.html`。
- Firebase Web SDK 只使用 Authentication 與 Firestore。
- 未登入 Rules 拒絕、已登入匿名使用者可依 strict schema 存取共享 `cases`。
- create、calculate、revision 與 report draft 使用 client transaction／version。
- 報告保存案件內 snapshot；系統不在後端生成、上傳或保存 PDF。
- 報告 HTML 使用專案內建的 Noto Sans TC 字型檔，列印入口會等待字型與圖片完成載入後才開放。
- UI 使用「報告草稿」「匯出」，舊 `ISSUED` 唯讀。
- 已移除 server API、Admin SDK、server session、Storage adapter 與 server PDF renderer。

## Gate 結果

| Gate                            | 結果 | 證據                                    |
| ------------------------------- | ---- | --------------------------------------- |
| format check                    | PASS | Prettier matched files                  |
| lint                            | PASS | ESLint 0 error / 0 warning              |
| typecheck                       | PASS | `tsc --noEmit`                          |
| unit                            | PASS | 9 files / 35 tests                      |
| Rules／repository integration   | PASS | 1 file / 5 tests                        |
| static build                    | PASS | Vite 8.1.5；155 modules；static `dist/` |
| E2E                             | PASS | 1440、1024、390 共 3 tests              |
| A4 列印輸出                    | PASS | Chromium PDF；5 頁 A4；逐頁視覺檢查     |
| `dist`／source forbidden search | PASS | 無 server bundle 或禁用 runtime         |
| production dependency audit     | PASS | 0 vulnerabilities                       |
| Hosting deploy                  | PASS | release `1784302105130000`               |
| production artifact provenance | PASS | 線上／本地 bundle SHA-256 相同             |
| production smoke               | PASS | Auth、Firestore、routes、console、network      |
| `git diff --check`              | PASS | 最終重跑                                |

E2E 已驗證自動匿名登入、建案、輸入編輯、雙軌計算、report preview、snapshot export、print stub、第二匿名 session、case/report route reload 及 revision +1。每個 viewport 均驗證 root overflow 與 critical console/page error；mobile 截圖另由人工抽查確認輸入矩陣、結果與 report cover 無裁切或重疊。

列印品質驗證使用 E2E 報告草稿實際輸出：PDF 為 5 頁、每頁 `594.96 x 841.92 pt` A4，逐頁轉圖檢查無裁切、重疊、缺字、孤立標題或頁尾錯號，跨頁表格會重複欄位標題。PDF 字型資源為 Chromium 生成的 Type3 glyph，開啟端不需另行安裝中文字型。

## 已知風險

- 匿名登入不驗證公司身分，網址外流者可讀寫共享案件。
- Rules 只驗證 JSON envelope；複雜工程內容由 client schema 驗證，無可信任後端。
- 報告草稿沒有正式簽核、不可變留存或 actor 真實身分保證。
- 內建字型、字型／圖片 ready gate 與 A4 print CSS 已降低不同電腦的排版差異；但 browser print 仍不保證不同瀏覽器列印引擎、頁邊設定或縮放選項下像素完全一致。
- production JS chunk 約 1,037 kB（gzip 約 314 kB）；Vite 發出 chunk size warning，後續可評估 route/vendor splitting。
- 完整 `npm audit` 有 5 個 moderate，全部來自 dev-only `firebase-tools` 的 OpenTelemetry／uuid 相依鏈；`npm audit --omit=dev` 為 0。`npm audit fix --force` 會降級 firebase-tools，未採用。
- integration／E2E 使用暫存目錄內官方 Temurin JRE 21.0.11；它不是專案 dependency，也未修改系統 Java 安裝。

## Production Release

- URL：`https://jenfu-grease-trap-calculator.web.app`。
- release commit：`f0ccc1c`；Hosting version：`ca30cb18c51ffbae`。
- 未登入 Firestore 讀取為 403；兩個不同匿名 session 皆可讀取共享案件。
- `/cases`、`/cases/new`、任意 case ID 與 report URL 皆由 Hosting SPA rewrite 回應 200。
- post-deploy browser smoke 的 console error、page error、非預期 request failure 與 root overflow 皆為 0。
- rollback：Hosting 前一 version `db5ac97927fc618a`；Firestore Rules 本次未變更。
