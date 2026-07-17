# SPEC-002｜油脂截留器雙軌計算系統 UI／UX 契約

文件狀態：`Implemented Locally`

版本：`2.0`

日期：`2026-07-17`

## 1. UX Intent

公開連結載入後自動匿名登入，讓同事直接處理共享案件。畫面必須清楚說明下一步、單位、來源與限制，但不得把 Anonymous Auth 描述成公司身分，也不得暗示報告具有正式簽核或後端可信度。

## 2. Routes

| Route               | 目的                        | Primary action             |
| ------------------- | --------------------------- | -------------------------- |
| `/cases`            | 共享案件清單、篩選、刪除    | `建立案件`／`開啟案件`     |
| `/cases/new`        | 任務、模式與案件資料精靈    | `建立案件並填寫計算資料`   |
| `/cases/:id`        | 輸入、計算、結果、修訂      | `開始計算`／`預覽報告草稿` |
| `/cases/:id/report` | 草稿 preview、export、print | `匯出報告草稿`             |
| `/rules`            | 規則版本與來源              | 無修改 action              |

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
- 每列顯示案件、客戶／地點、任務／模式、狀態、更新時間、下一步與刪除。
- 刪除使用 confirm，清楚說明共享案件與報告草稿會永久刪除。
- 行動版表格轉為可讀的 label/value layout；不得以 page-level horizontal scroll 解決。

## 5. 建立案件精靈

1. 選擇五大任務。
2. 選擇內政部、臺北市說明或不同計算依據對照。
3. 填寫選填的客戶、地點、案件名稱、用途與證據來源。

餐飲類型在案件工作台選擇，不在建案 step 重複。每步只突出一個 primary CTA，返回為 secondary。

## 6. 案件工作台

- Header：案件編號、修訂、名稱、客戶、地點、返回清單。
- 有 report draft 或歷史資料時提供 `建立新修訂版`，並以 confirm 說明會清除計算與草稿。
- 摘要：任務、模式、計算狀態、案件狀態、完整性 badges。
- 計算欄位依任務與軌別動態呈現；所有數值有 label、unit 與 help。
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

## 8. 報告草稿

- Header 必須使用「報告草稿預覽」。
- 未保存：warning 說明匯出會保存 case snapshot 並開啟列印。
- 已保存：說明「報告草稿已保存於共享案件」。
- 固定揭露：不是公司身分驗證、正式簽核或正式核發；系統已使用隨站字型與列印前資產檢查，但紙張、縮放與列印引擎仍可能造成細微差異。
- `匯出報告草稿` 保存 snapshot 並更新 iframe 後，等待字型、圖片及畫面繪製完成才呼叫列印。
- `列印／另存 PDF` 只呼叫 iframe 的 browser print；不顯示 upload、download stored PDF 或雲端檔案連結。
- iframe 尚未完成資產載入時，列印按鈕 disabled；準備列印時顯示「正在準備列印…」，失敗時提供可重試錯誤。
- iframe title 與文件 H1 均包含「報告草稿」。

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
- UI 不出現登入頁、角色設定、送審／覆核、正式核發或已保存 PDF 的 active action。
