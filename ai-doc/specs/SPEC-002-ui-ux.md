# SPEC-002｜油脂截留器雙軌計算系統 UI／UX 契約

文件狀態：`Implemented Locally`

版本：`2.4`

日期：`2026-10-01`

## 1. UX Intent

公開連結載入後自動匿名登入，讓同事直接處理共享案件。畫面必須清楚說明下一步、單位、來源與限制；任何使用者都能產出正式報告，但不得把 Anonymous Auth 描述成公司身分或暗示另有簽核與核發流程。

## 2. Routes

| Route               | 目的                     | Primary action             |
| ------------------- | ------------------------ | -------------------------- |
| `/cases`            | 共享案件清單、篩選、刪除 | `建立案件`／`開啟案件`     |
| `/cases/new`        | 計算任務、模式與案件資料精靈 | `建立案件並填寫計算資料`   |
| `/cases/:id`        | 輸入、計算、結果、修訂   | `開始計算`／`預覽報告草稿` |
| `/cases/:id/report` | 草稿預覽、草稿／正式 PDF | `產生正式報告`             |
| `/rules`            | 規則版本與來源           | 無修改 action              |

每個 dynamic route 必須支援貼上網址直接開啟及重新整理。未知 route 顯示返回案件清單的 Not Found state。

## 3. Authentication Gate

- 移除 login page、帳密欄位及角色管理。
- Auth pending：只顯示「正在建立匿名連線」，不得顯示案件資料或主要 action。
- Auth failed：顯示可理解的原因、技術 code 與 `重試`。
- Auth complete：render 正常 routes。
- 全站適當位置揭露網址外流與共享資料風險；README 是完整安全揭露權威。

## 4. 案件清單

- 搜尋：案件編號、客戶、案件名稱。
- 篩選：模式、草稿／已計算／報告草稿／歷史核發／待補資料。
- 每列顯示案件、客戶／地點、計算任務／模式、狀態、更新時間、下一步與刪除。
- 刪除使用 confirm，清楚說明共享案件與報告草稿會永久刪除。
- 行動版表格轉為可讀的 label/value layout；不得以 page-level horizontal scroll 解決。

## 5. 建立案件精靈

1. 選擇六個計算任務。
2. 選擇內政部、臺北市說明或不同算法依據對照。
3. 填寫選填的客戶、地點、案件名稱、用途與證據來源。

餐飲類型在案件工作台選擇，不在建案 step 重複。每步只突出一個 primary CTA，返回為 secondary。

選擇「我知道設備有效容積，要換算設計處理水量」時，第二步只顯示算法 A 並固定 `LEGACY_QV`；不得顯示算法 B 或雙軌選項。

## 6. 案件工作台

- Header：案件編號、修訂、名稱、客戶、地點、返回清單。
- 有 report draft 或歷史資料時提供 `建立新修訂版`，並以 confirm 說明會清除計算與草稿。
- 摘要：計算任務、模式、計算狀態、案件狀態、完整性 badges。
- 計算欄位依任務與軌別動態呈現；所有數值有 label、unit 與 help。
- 有效容積換算處理水量只顯示「設備有效容積」與「有效容積資料來源／證據」，不要求人數、面積、q、t 或 k。
- 雙軌使用並列 panels；小 viewport 改為單欄。
- 計算按鈕在輸入區尾端；首次為 `開始計算`，已有 run 為 `重新計算`。
- 舊 `ISSUED`／`SUPERSEDED` 禁止編輯與重算，只能查看歷史資料或建立新修訂。

## 7. Now What States

| State                    | 訊息                         | Primary CTA        |
| ------------------------ | ---------------------------- | ------------------ |
| 尚未計算                 | 先填完任一可用軌必要資料     | `開始計算`         |
| `BLOCKED`                | 顯示缺欄位及錯誤             | `重新計算`         |
| `COMPLETE`               | 計算完成，可預覽與匯出草稿   | `預覽報告草稿`     |
| `COMPLETE_WITH_REMINDER` | 一軌完成，另一軌未計算不阻擋 | `預覽報告草稿`     |
| `REPORT_DRAFT`           | 草稿已保存，仍可重算或建修訂 | `預覽報告草稿`     |
| legacy `ISSUED`          | 歷史資料唯讀，不建立新核發   | `查看歷史報告資料` |

## 8. 報告草稿與正式報告

- Header 必須使用「報告草稿預覽」，不另顯示案件編號／修訂版次小字。
- 報告預覽頁不常駐顯示保存狀態 banner，也不重複顯示案件摘要 grid；保留必要的報告操作與文件預覽。
- 報告範圍提供「精準計算-只計算本次計算任務」及「完整計算-包含參考計算」兩種選擇。
- `匯出報告草稿` 保存 snapshot；`產生草稿 PDF` 產出沒有正式報告編號的草稿。
- `產生正式報告` 是頁面唯一 primary CTA；不顯示送審、覆核、核准、角色或權限控制。
- 尚未保存草稿時，按下 `產生正式報告` 自動保存當下 snapshot，再直接產出正式 PDF。
- 案件編號與修訂版次由報告內容與案件頁承擔，預覽頁不重複顯示第二組摘要；正式報告沿用該案件編號。本機 PDF helper 成功後顯示儲存路徑；正式 Hosting 顯示列印視窗已開啟並提示另存為 PDF，不導向第二個下載頁。
- 報告內「案件資料」使用扁平標籤／值排列；案件、客戶、設置地點、本次計算任務與算法依據均保留，避免使用逐列大型表格。
- 用語固定：「計算任務」指使用者選擇的計算類型；「本次計算任務」指報告主要呈現的任務；「參考計算」指同份報告中供補充或比較的其他計算；「算法依據」指計算採用的來源文件與算法 A／B；「用途／情境」指使用者自行填寫的案件背景。
- 報告使用可複製且可存取的實際章節編號；主章為 `1`、`2`、`3`、`4`，方法與步驟依層級延伸為 `2.1`、`4.1`、`4.1.1`。
- PDF 產生中停用互斥操作並顯示進度；失敗時提供可重試錯誤。
- iframe title 與文件 H1 均包含「報告草稿」。
- 正式 PDF H1 不含「草稿」，封面顯示案件編號 `GTC-YYMMDD-00` 與案件修訂版次；其餘計算內容與草稿相同。

## 9. Error States

必須有專用文案與 retry：

- Anonymous Auth disabled／network failure。
- Firestore `permission-denied`。
- Firestore `resource-exhausted`／quota。
- Firestore `unavailable`／network。
- stale version／transaction conflict。
- report print frame 尚未 ready。

錯誤不得露出 private config、Firestore document payload、stack 或內部路徑。

## 10. Responsive 與 Accessibility

- 驗證 viewport：1440×900、1024×768、390×844。
- `documentElement.scrollWidth <= clientWidth + 1`。
- header/actions 可換行；固定格式 controls 有穩定尺寸。
- 欄位 label 與 button text 不截斷、不重疊。
- 使用語意 heading、label、fieldset、legend、status、alert 與 keyboard focus。
- help dialog 支援 Escape、關閉後 focus 返回 trigger。
- iframe 預覽不得造成 page horizontal overflow。
- A4 print CSS 只作用於報告內容；網站 chrome 不進入列印，表格列、圖片及標題不得被不合理斷頁。

## 11. UI Acceptance

- 三 viewport 完成 anonymous sign-in、建案、輸入、雙軌計算、report preview、export 與 print entry。
- 第二個匿名 browser context 可讀取第一個 context 建立的共享案件。
- case 與 report dynamic URL 直接開啟及 reload 成功。
- 無 visible runtime error、水平 overflow、incoherent overlap 或 critical browser console error。
- UI 不出現登入頁、角色設定、送審／覆核或核發 action；正式報告由任何使用者直接產出。
