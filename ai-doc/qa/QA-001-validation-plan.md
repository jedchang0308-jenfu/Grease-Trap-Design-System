# QA-001｜Firebase Spark 純靜態版本驗證計畫

文件狀態：`Active`

版本：`2.2`

日期：`2026-09-18`

## 1. 目標

驗證雙軌計算核心未因報告輸出變更而回歸，且 Anonymous Auth、Firestore client repository、Rules、report draft、直接正式報告輸出與 responsive UI 符合 ADR-009 及 ADR-010。

## 2. 風險矩陣

| 風險                                     | 等級 | 控制                                      |
| ---------------------------------------- | ---- | ----------------------------------------- |
| 公式／單位／捨入回歸                     | P0   | golden unit tests、raw/adopted assertions |
| 未登入可讀寫 Firestore                   | P0   | Rules integration negative test           |
| Rules 可寫未知欄位或跳 version           | P0   | schema／oversize／version negative tests  |
| transaction 靜默覆蓋                     | P1   | repository multi-session integration      |
| static route refresh 404                 | P1   | production preview direct route + reload  |
| 匿名登入前洩漏案件                       | P1   | Auth gate E2E／component behavior         |
| 正式報告編號或版次錯置                   | P1   | unit mapping + E2E saved filename         |
| 正式報告誤加入簽核或核發 gate            | P1   | unit content + E2E direct action          |
| PDF 本機 renderer 進入 production bundle | P1   | source/dist search                        |
| 字型／圖片未完成即產生 PDF               | P1   | renderer font/image readiness             |
| quota／permission／network 無法恢復      | P1   | problem mapping unit tests + retry UI     |
| mobile overflow／overlap                 | P1   | 390 screenshot + numeric overflow check   |
| 有效容積任務誤開放算法 B／雙軌          | P1   | UI、schema、Rules 三層負向驗證            |
| 有效容積被誤當名目容積或公式單位錯置    | P1   | 欄位說明、domain golden case、報告步驟    |

## 3. Gate Commands

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

`test:integration` 與 `test:e2e` 需要 Java 11+，使用 `demo-grease-trap` Auth／Firestore Emulator，不得連接 production project。

## 4. Unit Tests

- Current Q/G：人數、面積、Q/G 控制條件、A-36 分段 solver、嚴格不等式。
- Legacy Q/V：人數、面積、有效容積反推、q/k exact selection。
- Legacy T06：`500 L -> 3000 L/h -> 50 L/min`，並保留有效容積資料來源。
- Orchestrator：單軌、雙軌、一軌完成、零軌 blocked。
- 精度：Decimal raw、source display、adopted 與 rounding direction。
- Schema：建案、輸入、report snapshot strict parsing。
- Report HTML：草稿／正式 H1、正式編號與版次、來源章節、草稿標記隔離。
- Report number：正式報告必須直接使用 `GTC-YYMMDD-00`，不得另建前綴或轉換函式。
- Problem mapping：Auth、permission、quota、unavailable、timeout。

## 5. Firestore Rules／Repository Integration

必要案例：

1. 未登入 context 的 case read/write 均被拒絕。
2. Anonymous session A 建案，session B 可讀取。
3. Session B transaction 更新後，session A 讀到 version +1。
4. 未知 top-level 欄位被拒絕。
5. 超過最大長度字串被拒絕。
6. version 跳號被拒絕。
7. 未宣告 `reports` 等 collection 被拒絕。
8. repository encode/decode 保留 strict schema。

不得以 `allow read, write: if true` 或 Rules disabled 方式讓測試通過。

## 6. Static Build

- `npm run build` 產生 `dist/index.html` 與 browser assets。
- `dist/` 不得有 server bundle、API handler、Admin SDK、service account 或 Node runtime entry。
- `firebase.json` public=`dist`，rewrite `**` 到 `/index.html`。
- production dependency tree 不含 Next.js、Firebase Admin 或 Playwright runtime。
- Web config 只從靜態 `VITE_FIREBASE_*` build variables 讀取。

## 7. E2E

每個 1440×900、1024×768、390×844 project：

1. 開啟 `/cases`，自動 Anonymous Auth 後顯示案件清單。
2. 建立雙軌案件，填寫案件資料與餐飲類型。
3. 編輯人數並完成雙軌計算。
4. reload `/cases/:id`，資料與結果仍存在。
5. 開啟 `/cases/:id/report`，預覽 report draft。
6. 匯出 snapshot，看到共享案件保存狀態。
7. 產生草稿 PDF，確認原頁成功訊息及本機儲存路徑。
8. 直接產生正式報告，確認 `GTC-YYMMDD-00-R01.pdf` 與成功訊息；不得出現第二套報告編碼、簽核或核發 gate。
9. reload report route，已匯出狀態存在。
10. 第二匿名 browser context 直接開啟同 case 與 report route。
11. 建立新修訂，revision +1 且 calculations/report draft 清除。

T06 targeted UI 案例：

1. 在正常建案入口選擇「我知道設備有效容積，要換算設計處理水量」。
2. 計算模式只出現算法 A。
3. 建案後只顯示有效容積與資料來源欄位。
4. 輸入 `500 L` 後結果顯示 `50 L/min`，畫面不得出現 visible error。
5. 390×844 不得有水平 overflow、重疊或截斷。

每個主要 state 保存 full-page screenshot 到 OS temp evidence，不提交 binary artifacts。

## 8. UI QC

- `scrollWidth <= clientWidth + 1`。
- 無 component overlap、截斷、不可理解的空白 state。
- Primary CTA 與 Now What 訊息一致。
- report iframe 可讀、A4 print stylesheet 與隨站字型存在；桌面流程輸出測試用 PDF 並渲染檢查分頁、溢位與缺字。
- browser console error 與 pageerror 陣列為空。
- Auth pending／failure 不 render 案件 routes。

## 9. Forbidden Search

production source 不得存在或引用：

- `firebase-admin`、`next/server`、server cookie、session handler。
- `src/app/api` route handlers 或 `/api/*` business request。
- production Playwright PDF renderer、Cloud Storage report save。
- App Hosting runtime、Cloud Functions 或 Cloud Run entry。

文件可以在「不使用／已移除」的否定語境記錄架構取捨。

## 10. Stop Conditions

- 任何計算 golden case 或精度 assertion 失敗。
- 未登入 Rules 可讀寫，或未知欄位可寫入。
- second anonymous session 無法讀共享案件。
- dynamic route refresh 404。
- 三 viewport 任一有水平 overflow、主要操作重疊或 critical console error。
- build 需要 server runtime 或產物不是純靜態。
- 缺 Java 時 integration／E2E 應標記未執行，不得宣稱通過。

## 11. Production Re-entry

本計畫不授權部署。建立專用 Firebase project 後，需再次執行全 gate，部署 Rules 與 Hosting，再做 production smoke、quota 觀察與 rollback 準備；不得使用既有 PDM／ProJED project。
