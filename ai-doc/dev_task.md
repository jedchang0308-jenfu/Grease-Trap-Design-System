# DEV 任務總表｜油脂截留器雙軌計算系統

文件狀態：`DEV-037 原選值依據修改及本輪報告 A／B 對照表與美化預覽工具列已部署正式 Hosting；資產／路由 smoke 通過，指定案件 ID 在正式站不存在，因此資料載入後的報告 UI QC 待有效案件；DEV-036 用餐區面積雙欄與選擇性同步已實作／本次 UI QC 待補；DEV-035 查表說明整合覆蓋視窗已實作／本次 UI QC 待補；DEV-034 用水量參考表入口整合已實作／本次 UI QC 待補；DEV-033 雙算法輸入逐列比較已完成本機 UI 驗證；DEV-032 查表值預填已實作；DEV-031 本機啟動重用與埠衝突復原已完成；DEV-030 已部署`

版本：`5.73`

最後更新：`2026-10-07`

## 總任務清單

- ◐ DEV-037 [開發點] [報告對照表與緊湊預覽工具列已部署／正式資產 smoke 通過／資料載入 UI QC 待有效案件] [P2] [本輪可執行] 雙算法選值依據統一呈現
  - 摘要：算法 A、B 的選值依據同區對照；報告第 2 章沿用輸入設定頁的雙欄比較表，從已保存快照呈現欄位及採用值，預覽頁將標題、設定與操作整合為緊湊工具列。
  - 來源 ID：使用者指出 A、B 選值依據位於不同位置造成邏輯不一致，並要求依共同版型修改。
  - 父任務：DEV-036
  - 下一步：如需資料載入後的正式報告 UI QC，請提供正式 Firebase 專案中可讀的測試案件 ID；本次使用的案件 ID 在正式站不存在，未查閱其他案件或寫入資料。
  - 證據：本輪 source commit `3ef2b9d` 已部署至 `jenfu-grease-trap-calculator` Hosting（2026-10-07 live channel release）。部署範圍僅 Hosting，未部署 Rules、未寫入正式案件。正式首頁與 `/cases/01d94ca5-5431-4ae1-bf0e-03482b718610/report` 均 HTTP 200；線上 JS `index-BwLi2miJ.js` 與 CSS `index-BnkbXJrt.css` SHA-256 均與本機 `dist` 相同；JS 含報告比較表內容，CSS 含緊湊工具列選擇器。指定案件在 production 回報「找不到這筆共享案件」，所以未能檢視資料載入後的報告；隔離版面檢視仍確認桌機卡片 75px、390px 185px 且無水平溢出。`npm run typecheck`、修改檔 ESLint／Prettier、161 modules build、`git diff --check` 通過；build 有 Vite config 相容性及 bundle 大小警告。未執行測試套件。回復參照：已確認部署的 commit `e6b96e3`。
  - 計入交付：否

- ◐ DEV-036 [開發點] [實作完成／本次 UI QC 待補] [P2] [本輪可執行] 雙算法比較列呈現面積同步選項
  - 摘要：用餐區面積分為算法 A、B 兩個輸入欄，預設勾選同步且可取消；其他欄位維持獨立，差異與查表說明放在問號內，不另顯示不同步標籤或欄位下方提示。
  - 來源 ID：使用者先要求相關欄位不同步標示，後續明確指定用餐區面積改成兩欄並可選擇同步，預設勾選
  - 父任務：DEV-033
  - 下一步：對 T01／T03／T05 及 390px 窄版做唯讀 UI QC，確認差異可由問號說明辨識、版面無溢出且輸入值行為不變。
  - 證據：source-level review；`git diff --check` 通過。未執行測試套件、build 或 UI QC。
  - 計入交付：否

- ◐ DEV-035 [開發點] [實作完成／本次 UI QC 待補] [P2] [本輪可執行] 工作台所有查表參數改用覆蓋視窗
  - 摘要：說明與查表整合在同一欄位問號彈窗；有查表的問號以實心深色呈現，純說明使用淡色外框，兩者尺寸與位置一致。算法 A 安全係數類別及 exact k 說明均可直接對照 A／B／C 餐飲形式；算法 B 用水量及每日 t 表標明本案採用的方法。
  - 來源 ID：使用者要求「依據此查表的設計邏輯，將每個需要查表的選項都將上彈窗」並確認「都依此改成彈窗」；另要求安全係數 A／B／C 顯示對應餐飲形式
  - 父任務：DEV-034
  - 規格：SPEC-002 §6；不改公式、來源資料與案件契約。
  - 驗收：算法 A q、密度／翻桌率及 k；算法 B Wm′／Wm、k 及每日 t；單算法與雙算法表單均在對應問號內顯示欄位說明及查表 modal。問號同尺寸、同位置，查表欄位為深色實心，純說明為淡色外框。安全係數表列出 A／B／C 餐飲形式、exact k 範圍及來源；可用關閉鈕、遮罩或 Esc 關閉；手機表格不造成頁面水平溢出。
  - 下一步：複驗 T01／T03／T05 雙算法與單算法工作台，確認兩種問號樣式、表格內容、目前選用提示、關閉方式及手機版面。
  - 計入交付：否

- ◐ DEV-034 [開發點] [入口整合實作完成／本次 UI QC 待補] [P2] [本輪可執行] 比較列覆蓋視窗顯示算法 A／B 用水量參考表
  - 摘要：算法 A 的 q 範圍表與算法 B 的 Wm′／Wm 來源值表，從比較列對應欄位的問號開啟；說明文字與參考表同窗顯示。
  - 來源 ID：使用者要求「將各自的用水量參考表作成展開放在這邊」，續指「這些表改成覆蓋式的」
  - 父任務：DEV-033
  - 規格：SPEC-002 §6；不改變公式、參數資料或案件契約。
  - 驗收：T01 顯示 A q 與 B Wm′ 表；T03 顯示 A q 與 B Wm 表；T05 的 B 表同時顯示 Wm′／Wm；同尺寸問號開啟說明與查表彈窗，且比較列高度不變；可用關閉鈕、遮罩或 Esc 關閉；窄版不造成頁面水平溢出；單算法 q 參考表仍可用。
  - 下一步：補驗 T03／T05 的實際查表內容與目前選用餐飲類別。
  - 計入交付：否

- ✓ DEV-033 [開發點] [本機 UI 驗證完成] [P2] [本機已驗證] 工作台雙算法輸入逐列比較
  - 摘要：雙算法案件改用共同比較表，讓對應欄位與算法 A／B 輸入值同列呈現；單算法沿用原表單。
  - 來源 ID：使用者要求「把相同屬性的東西盡量擺在同一行上，呈現方式也盡量一致，方便比較」並明確要求「做一個commit後開始執行」
  - 父任務：DEV-021
  - 規格：SPEC-002 §6；不改變公式或案件資料契約。
  - 驗收：雙算法欄位按任務呈現且對應項目同列；期間與單位差異清楚標示；方法不使用的欄位標示原因；共用用餐區面積僅可編輯一次並同步兩軌；B 的查表 t 仍可編輯並保留覆寫行為；窄版依欄位順序顯示算法 A、B。
  - 下一步：無；T01／T03／T05 的桌機與 T01 390px 窄版已驗證，未操作既有案件或執行計算。
  - 證據：`npm run typecheck`、受影響檔案 ESLint、Prettier、`npm run build`、`git diff --check`；隔離 demo Emulator UI smoke：T01 查表 t=720，編輯為 900 後切換餐飲類型仍保留 900；T03 只顯示一個共用面積欄位；T01 手機版 document width=390 且無 page error；T01／T03／T05 桌機畫面無 page error。暫存 Emulator 已停止，測試案件隨記憶體資料消失；未執行計算或測試套件。
  - 計入交付：否

- ◇ DEV-032 [開發點] [實作完成／待 UI 驗證] [P2] [本機未驗證] 算法 B t 預填適用查表值且可編輯
  - 摘要：每日廚房使用時間 t 依計算任務與餐飲類型預填適用來源表值；使用者可編輯，手動值保留為案件覆寫。
  - 來源 ID：使用者要求「系統改成會填入查表的帶入值，使用者可以再編輯」
  - 父任務：DEV-021
  - 規格：SPEC-001 §4.1、SPEC-002 §6；不變更工程公式。
  - 驗收：依任務帶入 A-37 或 A-34～A-36；T05 只在兩來源值一致時共用預填；餐飲類型切換時更新尚未手動修改的查表值；使用者編輯值可覆寫並保存；原查表值不保存成覆寫。
  - 下一步：待瀏覽器 UI 可用後，唯讀確認初始帶入值、餐飲類型切換、手動修改及計算效果。
  - 證據：source-level data flow review、`git diff --check` 通過。未執行測試套件、typecheck、build 或 UI 驗收；browser automation 啟動因 Windows error 5 退出，未操作既有案件分頁或寫入案件資料。
  - 計入交付：否

- ✓ DEV-031 [開發點] [完成] [P2] [本機完成] 重複執行 dev:local 時重用同專案 runtime
  - 摘要：辨認同專案 Emulator Hub 並重用服務；Emulator 預設埠被占用時尋找可用替代埠；Vite `3100` 無法辨認歸屬時保留原程序並列出 PID／程序名稱。
  - 來源 ID：使用者要求「請修復」本機 dev:local 的 Firebase port collision
  - 父任務：DEV-021
  - 證據：PowerShell AST、`git diff --check`、同專案 Hub／Auth／Firestore／Vite reuse smoke、Firestore `8080` 與 Emulator UI `4000` 外部占用下的 `dev:local` 啟動與重用 smoke；HTTP `/cases` 回應 200、Hub 回報 Firestore `8081`。外部 PID 保留；目前 runtime 依使用者「開始執行」要求維持運作，清理 owner 為本任務；未執行測試套件
  - 計入交付：否

- ◇ DEV-030 [開發點] [驗證中] [P2] [沿用既有 production 授權] 全系統「算法依據」用語統一
  - 摘要：報告、計算狀態、參數標籤、工作台提示及有效規格，將原「計算依據」統一為「算法依據」；不改變計算與資料契約。
  - 來源 ID：使用者要求「改成『算法依據』，其他地方比照辦理」
  - 父任務：DEV-028
  - 下一步：若需視覺截圖驗收，待 browser automation 可用後，對報告 route 做唯讀 hard-reload 確認。
  - 證據：commit `5a9ad5c`、format、typecheck、targeted lint、160 modules build、Hosting deploy；production root／report／rules route HTTP 200，bundle `/assets/index-BYQ8Msmu.js` 含「算法依據」且不含舊用語。UI screenshot 未驗證：CUA Node process 連續兩次意外退出；未操作使用者分頁、未寫入 production 資料；unit tests 未執行。
  - 計入交付：否

- ✓ DEV-029 [交付點] [完成] [P1] [已發版] 案件歷史版本保留與唯讀查看
  - 摘要：建立新版本前保留舊版，提供同案版本紀錄與唯讀查看；刪除涵蓋全部版本，歷史報告可依目前版型標示後重新輸出。
  - 來源 ID：使用者要求「我要可以看歷史版本，請寫開發文件」
  - 下一步：無；後續涉及歷史資料契約、Rules 或報告 renderer 的變更，沿用本次 production feature smoke 並重新執行清理確認。
  - 證據：ADR-012、SPEC-003、QA-002、commit `2e1d261`、Rules／Hosting deploy、51 unit、7 Firestore integration、3 viewport Playwright E2E、lint、format、typecheck、build、static production smoke、production Auth／Firestore read-only smoke、一次性授權 production fixture 完整 history smoke 與清理證據
  - 計入交付：是

- ✓ DEV-028 [開發點] [完成] [P2] [本機完成] 報告計算任務與參考計算視覺分層
  - 摘要：報告預設只輸出本次計算任務相關的輸入、結果與計算步驟；是否納入其餘參考計算改由報告外層設定，產出的報告本文不含展開按鈕或參考分界文字。
  - 父任務：DEV-024
  - 證據：47 個 unit tests、typecheck、targeted lint、build、live T01 桌機／390 UI QC（含兩種設定狀態）
  - 計入交付：否

- ✓ DEV-024 [交付點] [完成] [P1] [本機完成] 報告改為不同計算方式對照版型
  - 摘要：雙軌報告先比較採用結果，再依計算依據呈現連續公式步驟；計算過程不重複列出主題採用值或結果主題小標，並移除無效換算訊號。
  - 父任務：DEV-022
  - 證據：SPEC-001、45 個 unit tests、typecheck、targeted lint、build、1440／390 UI QC
  - 計入交付：是

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

### DEV-037｜雙算法選值依據統一呈現

狀態：`原選值依據修改及本輪報告對照表／緊湊工具列已部署／正式資產與路由 smoke 通過／資料載入 UI QC 待有效案件`

節點類型：開發點

父任務：DEV-036

是否計入產品交付完成：否

原始需求邊界：使用者指出算法 A、B 的選值依據分置於不同位置，使閱讀邏輯不一致，並要求依統一的對照方式修改。

任務目標：讓使用者在輸入設定與報告中都能依相同欄名和順序閱讀算法 A、B 的資料；報告值以本次已保存計算快照為準。

風險等級：`Medium`

開發範圍：

- 將原「來源參考與選值理由」改為「本案選值依據」，算法 A、B 以並列欄位呈現相同順序的本案計算方法、資料來源、本案採用參數、選值理由及補充資料。
- 算法 A 保留必填的來源類型；「本案選值依據」區的理由與補充證據選填。理由留白不新增表單必填限制或缺少理由警示；已有文字仍隨輸入保存並列入報告摘要。載入既有案件時保留已存理由，對舊 `selectionReason` 提供顯示相容；既有工程輸入驗證維持不變。
- 算法 B 明確呈現本案採用的人數法／面積法、餐飲類型、附錄 5 來源表參數、每日 t 的來源表值與計算採用值及覆寫狀態；允許補充理由和證據。
- 算法 B 的選值來源、理由與證據以 optional metadata 隨輸入保存並列入報告輸入摘要；計算公式與查表／覆寫行為不變。
- 所有新增欄位顯示可見標籤；補充資料收合為選填區塊；不在其他位置重複顯示選值摘要。
- 雙算法報告第 2 章沿用輸入設定頁的 A／B 對照表樣式、表頭與任務適用列順序；T01、T03、T05 依任務呈現對應欄位，避免把兩軌欄位併成兩份清單後留下空白格。
- 報告只讀已保存 snapshot 的輸入與計算步驟代入值；需要補列來源表值時，僅在規則代碼、版本與 checksum 完全相符時使用對應版次。未完成、不適用、快照未記錄及選填未填寫均在儲存格明示。
- 報告的 A／B 表格與輸入設定頁共用比較項目標籤；不變更公式、計算資料或已保存 snapshot schema，也不讀取工作台未保存編輯值。
- 報告預覽標題、報告設定與保存／PDF 操作整合為桌機緊湊卡片式工具列；以使用者標記的 1242 × 668 畫面區域 261.6px 為基準，桌機工具列控制區目標不超過 105px（至少減少 60%），較窄畫面依序換列或堆疊且不可水平溢出；正式 PDF 維持唯一主要按鈕。
- 工具列以單一淺色卡片承載；標題與返回連結、報告設定、保存／輸出按鈕各自成組，選中設定具清楚但克制的底色與邊界，操作群組以細分隔線區分；不增加額外操作或改變按鈕層級。

驗收標準：

- 雙算法工作台只有一個「本案選值依據」區塊，A、B 以相同欄位次序並列呈現；窄版先顯示 A 再顯示 B。
- 兩側均清楚顯示本案方法、資料來源、本案採用參數、選值理由及補充資料；B 的方法與餐飲類型、所有當前適用的查表參數均可辨識。
- B 時間列能分開呈現來源表 t、計算採用 t 與目前使用來源表／使用者調整狀態；T05 來源值不一致時明示兩種方法各自採用來源值。
- 「本案選值依據」區中 A、B 的選值理由與補充證據選填；A 的資料來源類型仍必填。理由留白不新增表單必填限制或顯示缺少理由警示；既有工程輸入驗證不變。已填文字與舊案件來源／理由／證據均可保存、載入並列入輸入摘要。
- 開始計算、查表、餐飲類型切換及 t 覆寫計算行為不因新增依據欄位而改變。
- 雙算法報告第 2 章與輸入設定頁維持相同 A／B 欄位、共用比較列名稱及任務適用順序；表格各儲存格沒有未說明的空白或破折號。
- 報告參數只來自保存的輸入快照、保存的計算步驟代入值，或 checksum 一致的規則版本；變更工作台但未保存時不影響既有報告。
- 1242px 桌機畫面以同一卡片呈現報告標題、設定與操作；標題／返回位於左上、設定位於左下、操作群組靠右跨列。相較參考畫面標記的 261.6px 區域，卡片高度至少減少 60%。1024px 與 390px 版面保持可讀且無水平溢出。
- 主要背景、標題、返回連結、選項與操作按鈕形成清楚視覺群組；所選報告範圍容易辨識，正式 PDF 仍是唯一主要按鈕。
- 草稿預覽、草稿 PDF 與正式 PDF 使用相同表格內容與呈現，不改變正式報告資料契約。

Spec Impact Preflight：`Presentation contract update`。更新 SPEC-002 §8，明定雙算法報告採用輸入設定頁的對照表結構並依保存快照取值；不改公式、snapshot schema 或輸出資料契約。

驗證結果：工具列在隔離瀏覽器排版畫面以 1242、1024、390px 寬度檢視；桌機與 1024px 控制卡高 75px，對照使用者原標記的 261.6px 高區域約減少 71%；390px 高 185px；三種寬度均無水平溢出。`npm run typecheck`、修改檔 ESLint、修改檔及開發文件 Prettier、161 modules production build、`git diff --check` 通過。Build 有 Vite config 相容性及 bundle 大小警告。Firebase Hosting 已發布 commit `3ef2b9d`；正式首頁與指定報告 route HTTP 200，線上 JS／CSS SHA-256 與本機 build 完全相同，資產含報告比較表及緊湊工具列。指定案件 ID 在正式站不存在，故資料載入後的報告畫面尚未驗證；未讀取其他正式案件、未寫入資料。未執行測試套件。

變更紀錄：

- 2026-10-07：依使用者要求，報告雙算法輸入條件改沿用輸入設定頁 A／B 對照表；共用列標籤，依已保存快照與計算步驟顯示值，並明確呈現未完成、不適用、未收錄及選填空值狀態。未執行 typecheck、build、UI QC 或部署。
- 2026-10-07：依使用者要求，將報告標題、設定與保存／PDF 操作整合為緊湊工具列；隔離 CSS 版面檢視顯示 1242px 桌機標記區域高度約減少 76%，1024px 與 390px 無水平溢出。完整本機模擬器受埠綁定權限限制未能啟動；案件頁互動 QC、typecheck、build 與部署待辦。
- 2026-10-07：依使用者回饋美化工具列，加入淺色卡片、標題／返回連結、選中選項與輸出群組的層次；隔離 CSS 檢視確認桌機控制卡 75px、對照原標記區域約減少 71%，各寬度無水平溢出。完整案件互動 QC 與部署仍待辦。
- 2026-10-07：依使用者要求執行正式部署；typecheck、修改檔 lint／format、production build 通過。Firebase CLI 回報憑證失效，沙盒外重試亦無有效登入，因此 Hosting 尚未發布；需重新登入後續行。
- 2026-10-07：使用者完成 Firebase 重新登入後，commit `3ef2b9d` 已部署至正式 Hosting。首頁與指定報告 route HTTP 200，線上 JS／CSS 與本機 build SHA-256 相同；指定案件 ID 不存在於正式站，資料載入後 UI QC 待有效案件。

### DEV-036｜雙算法比較列呈現面積同步選項

狀態：`實作完成／本次 UI QC 待補`

節點類型：開發點

父任務：DEV-033

是否計入產品交付完成：否

原始需求邊界：用餐區面積依最新決策提供可選同步；其他欄位維持獨立輸入，欄位定義、算法差異與查表解釋由問號說明呈現，不另顯示不同步標籤或欄位下方提示。

範圍承接：本任務以最新決策取代 DEV-033 原先「面積只顯示一欄」的呈現方式；算法公式與資料契約不變。

任務目標：讓使用者在逐列比較算法 A／B 時，能選擇同步用餐區面積，並辨識其他僅主題相關、仍須分開輸入的欄位。

開發範圍：

- 用餐區面積在算法 A、B 各顯示一個可編輯欄位，並以預設勾選的「同步兩邊」控制雙向同步；取消後分開保存。
- 載入兩側已保存的不同面積時保留各自值，並預設取消勾選，避免靜默覆寫。
- 重新勾選時以最後修改的一側帶入另一側；若本次頁面尚未修改，以算法 A 為同步來源。
- 比較列不另顯示「不同步」標籤；欄位定義、統計期間與來源差異保留在各列問號說明中。
- 比較表各欄位下方不顯示補充提示；保留參數值、細項標籤與單位，說明內容由對應問號開啟。
- 算法 B 面積換算參數的來源與不另填理由收在欄位問號說明中，表格內以簡短來源提示搭配純說明問號呈現。
- 算法 B 面積換算參數列顯示目前帶入的 n、n₀；面積反推時說明 n₀依候選面積查表。
- 算法 A 面積換算參數欄位各自顯示「人員密度」「翻桌率」細項標籤。
- 不改變其他輸入資料流、公式、查表、保存或換算行為；同步選項不新增案件資料欄位。

驗收標準：

- 雙算法比較表中的面積列有算法 A、B 兩欄與同步核取方塊，初始為勾選；勾選時編輯任一欄同步另一欄，取消後可輸入不同值。
- 載入面積相同或只有一側有值的案件時預設勾選；載入兩側不同值時保留兩值並預設取消。
- 取消後重新勾選會依最後修改的一側更新另一側；尚未編輯時以算法 A 值為準。
- 算法 B 面積換算參數列依目前餐飲類型與面積顯示 n、n₀；n₀無有效表值時清楚提示，反推任務則標明依候選面積查表。
- 算法 A 的密度與翻桌率標籤在桌機與輸入欄同行，窄版移至欄位上方以保留數值輸入寬度；單位與問號說明維持可辨識。
- 用餐區以外的欄位修改任一側，不會因本次變更而自動同步或換算另一側；算法定義或單位差異可由欄位問號說明辨識。
- 比較列不顯示額外關係標籤或欄位下方補充提示；T01／T03／T05 桌機及 390px 版面維持不截斷、不溢出。

Spec Impact Preflight：`Compatible exception`。更新 SPEC-002 §6 的比較列呈現，移除關係標籤與欄位下方補充提示，沿用問號說明；不改公式、來源資料或案件資料契約。

驗證結果：source-level review；`git diff --check` 通過。未執行測試套件、build 或 UI QC，畫面結果尚未驗證。

### DEV-035｜工作台所有查表參數改用覆蓋視窗

狀態：`實作完成／本次 UI QC 待補`

節點類型：開發點

父任務：DEV-034

是否計入產品交付完成：否

原始需求邊界：使用者要求所有需要查表的選項沿用用水量表的覆蓋視窗設計，並確認全部改為彈窗。

任務目標：讓使用者在填值、編輯覆寫或選擇來源類別時，就能從對應欄位開啟查表；表格不再內嵌展開於表單。

風險等級：`Medium`

開發範圍：

- 算法 A 的 q、密度／翻桌率及安全係數 k 參考表，於單算法與雙算法工作台以覆蓋視窗提供；安全係數類別與 exact k 的說明彈窗皆可直接查看 A／B／C 餐飲形式和 exact k 範圍，對照系統引用的 SRC-LEGACY-FULL 歷史原件 PDF 第 6–7 頁。安全係數類別彈窗依使用者最新要求刪除 k 範圍與跨算法不同步的補充段落，保留欄位定義及分類表。
- 算法 B 的 Wm′／Wm、依餐飲類型適用的 k 與每日使用時間 t 參考表，於單算法與雙算法工作台從對應欄位的問號開啟；說明與參考表同窗顯示。Wm′／Wm 與每日 t 的人數法／面積法欄均固定呈現，並依 T01／T02、T03／T04、T05 標示本案採用方法。
- 查表問號以深色實心呈現，純說明問號以淡色外框呈現；尺寸與位置一致，並提供欄位化的輔助標籤。
- 所有 modal 保留目前適用類別標示，並可由關閉鈕、點遮罩或 Esc 關閉。
- 僅調整參考表入口與呈現方式，不改公式、表格值、預填／覆寫邏輯或案件資料。

驗收標準：使用者可由相應問號開啟欄位說明與查表 modal；查表與純說明問號尺寸和位置一致，顏色重量有區別；背景欄位列高度不因表格內容改變；算法 A 安全係數類別與 exact k 的說明彈窗皆列出 A／B／C 餐飲形式、exact k 範圍及來源；單算法與雙算法的 A、B 查表內容一致；算法 B 的 Wm′／Wm 與每日 t 來源表都固定列出人數法、面積法，並分別在 T01／T02、T03／T04、T05 標示人數法、面積法、兩者皆採用；390px 窄版表格可在 modal 內閱讀且頁面無水平溢出；關閉 modal 不修改欄位值。

Spec Impact Preflight：`Presentation contract update`。細化 SPEC-002 §6 的查表開啟方式；工程公式、來源資料與案件契約不變。

驗證計畫與結果：既有 TSX ESLint、TSX／CSS Prettier 與隔離 Playwright 結果，驗證的是前一版獨立參考表按鈕。之後已將說明與表格整合到問號彈窗、調整兩種問號樣式，並讓 Wm′／Wm 與每日 t 來源表依 T01／T02、T03／T04、T05 標示人數法、面積法或兩者。2026-10-05 刪除安全係數類別補充段落後，當前工作區 `npm run typecheck` 與 `git diff --check` 通過；未重跑 lint、格式檢查、測試套件或工作台 UI QC。待複驗桌機與 390px 下各查表彈窗、尺寸一致性、表格捲動、關閉方式及頁面水平溢出。

本次安全係數分類補充：依系統引用的 SRC-LEGACY-FULL 歷史原件 PDF 第 6–7 頁核對 A／B／C 共 18 項分類內容。官方 103.11.28 修正版將 B 類列為「中餐類」，歷史原件列為「火鍋類」；本 UI 沿用算法 A 現有來源並明確連結該版本。隔離 headless browser 在 T01 雙算法頁 1242×668 與 390×844 檢視彈窗：三欄與來源連結可見，窄版表格寬度 340px、頁面寬度 390px，無 page error；未操作使用者分頁、修改案件資料或執行計算。

### DEV-034｜比較列覆蓋視窗顯示算法 A／B 用水量參考表

狀態：`入口整合實作完成／本次 UI QC 待補`

節點類型：開發點

父任務：DEV-033

是否計入產品交付完成：否

原始需求邊界：使用者指定將各自的用水量參考表放在工作台雙算法比較表的「用水量參數」列，後續明確要求表格改成覆蓋式。

任務目標：讓使用者在比對算法 A 的 q 與算法 B 的 Wm′／Wm 時，從各自欄位問號開啟同時包含說明及參考表的覆蓋視窗，且不改變比較列高度。

風險等級：`Medium`

開發範圍：

- 算法 A 臺北市 q 範圍表由 A 欄位問號開啟覆蓋視窗；同表保留給單算法工作台使用。
- 算法 B 用水量問號參考表固定列出人數法 Wm′ 與面積法 Wm，並以「本案採用」標示目前任務適用的方法；比較表主欄仍只顯示本案適用的參數，資料沿用既有 rule seed。
- 說明與表格在同一覆蓋視窗呈現，不撐高比較列；可用關閉鈕、點遮罩或 Esc 關閉。移除比較模式下方重複的 A q 表，保留 B 的每日使用時間 t 查表入口。
- 不改公式、工程參數來源、案件資料、選值理由或計算行為。

驗收標準：

- T01、T03 的 B 用水量參考表均同時列出 Wm′／Wm，分別標示本案採用的人數法或面積法；主欄只顯示適用參數。T05 的參考表同時列出並標示兩種方法。
- 點擊各自欄位問號後顯示說明與查表覆蓋視窗，底下比較列高度不變；可用關閉鈕、點遮罩或 Esc 關閉。
- 390px 窄版可讀且頁面無水平溢出；表格若需捲動僅限表格容器。
- 單算法案件的 q 參考表仍可展開；展開／收合不修改案件資料。

Spec Impact Preflight：`Compatible exception`。細化 SPEC-002 §6 的來源表位置；工程公式、資料來源與案件契約不變。

驗證計畫與結果：先前隔離 Playwright 唯讀驗證及列高／390px 證據，針對舊版獨立參考表入口。本次改為問號內整合說明與表格後尚未重跑 UI QC；待複驗 T01／T03／T05、單算法、按鈕尺寸與顏色，以及手機表格與頁面溢出。未操作使用者既有分頁或執行計算；本次未執行測試套件。

### DEV-033｜工作台雙算法輸入逐列比較

狀態：`本機實作與 UI 驗證完成（T01／T03／T05 桌機；T01 390px 手機）`

節點類型：開發點

父交付點：DEV-021

是否計入產品交付完成：否

原始需求邊界：使用者要求讓算法 A／B 容易比較，將相同屬性盡量放在同一列且保持呈現方式一致，並指示先建立 checkpoint commit 再開始執行。

任務目標：在雙算法工作台用一張共同比較表呈現算法 A、算法 B 對應輸入；保留算法各自的資料意義、單位、查表參數、覆寫行為與計算資料流。

風險等級：`Medium`

開發範圍：

- 將分類／餐飲型態、人數、水量參數、使用時間 t、安全係數 k 與維護週期放在同列比較；依任務顯示面積或設備能力欄位。
- 明確標示不同時間基準、定義不同的參數與單一算法未使用的項目，不暗示數值可直接互換。
- 共用用餐區面積只保留一個輸入，更新後同步到兩算法。
- 算法 B 查表參數以唯讀值呈現，t 保持可編輯；算法 A 輸入與來源選值欄位持續保存原有案件資料。
- 雙算法窄版按欄位逐項呈現 A、B；單算法工作台維持既有表單。
- 不變更公式、案件資料結構、結果表或報告輸出契約。

驗收標準：桌機雙算法資料以同列呈現；人數及 t 的期間單位清楚；查表參數可辨識；A／B 不適用欄位標明原因；面積共用欄位只有一個可編輯輸入；切換餐飲類型時查表 t 更新條件及手動覆寫保留條件不變；單算法表單可用。

Spec Impact Preflight：`Presentation contract update`。更新 SPEC-002 §6；公式、資料契約與報告不變。

驗證結果：`npm run typecheck`、受影響檔案 ESLint、Prettier、`npm run build` 與 `git diff --check` 通過。隔離 demo Emulator UI smoke 驗證 T01／T03／T05 桌機列對齊、共用面積單欄位、t 查表預填及手動覆寫保留；T01 390px 手機版無水平溢出或 page error。三筆預覽案件只寫入本次記憶體 Emulator，停止後資料消失；未執行計算或測試套件。Build 顯示 Vite config native 相容性與 bundle size 警告。固定 `dev:local` 因 8080 被未確認來源的 Java PID 44196 占用而停止；改用隔離連接埠驗證，未終止或連線操作該程序。

### DEV-032｜算法 B t 預填適用查表值且可編輯

狀態：`實作完成 / UI 尚未驗證`

節點類型：開發點

父交付點：DEV-021

是否計入產品交付完成：否

原始需求邊界：使用者要求「系統改成會填入查表的帶入值，使用者可以再編輯」。

任務目標：工作台依本次計算任務及餐飲類型，把算法 B 每日廚房使用時間 t 的適用查表值帶入欄位，讓使用者可直接修改。

風險等級：`Medium`

開發範圍：

- 人數任務帶入 A-37 t；面積任務帶入 A-34～A-36 t。
- T05 共用欄位僅在兩張來源表都有值且相同時預填；不一致或缺值時保留原各自來源表計算。
- 餐飲類型切換時，若欄位仍是原查表值則更新；使用者已輸入不同值時保留該覆寫。
- 欄位值與目前適用查表值相同時，計算仍採來源表值且不保存為案件覆寫；編輯成其他值才覆寫。
- 更新 SPEC-001 與 SPEC-002 的有效契約，不變更公式、來源參數或案件資料架構。

驗收標準：初始欄位顯示適用查表值且可編輯；選擇餐飲類型後帶入對應值；切換類型不覆蓋使用者已修改的值；手動值能覆寫計算；查表值不會被誤存為覆寫來源。

驗證結果：source-level data flow review、`git diff --check` 通過。未執行測試套件、typecheck、build 或瀏覽器 UI 驗收；browser automation 啟動因 Windows error 5 退出，未操作既有案件分頁或寫入案件資料。待 browser automation 可用時確認初始帶入、類型切換、手動修改及計算效果。

### DEV-031｜重複執行 dev:local 時重用同專案 runtime

狀態：`完成 / PowerShell 5.1 Reuse Smoke Passed`

節點類型：開發點

父交付點：DEV-021

是否計入產品交付完成：否

原始需求邊界：使用者執行 `npm run dev:local` 遇到 Firebase Auth／Firestore port taken，要求修復。

任務目標：讓本機啟動入口辨認本專案已啟動的 Firebase Emulator Suite 並重用其服務；若預設 Emulator 埠被其他服務占用，選擇可用埠啟動且讓 Vite 連線到實際埠號。

風險等級：`Low`

開發範圍：

- 依 Firebase CLI project-specific hub locator、存活 PID 與 Hub API 確認 `demo-grease-trap` 的 Auth／Firestore runtime。
- 若本系統 Vite 頁面已在 3100 回應，列出既有 URL 並成功結束；否則重用 emulator 啟動 Vite。
- 預設 Auth／Firestore／UI／Hub／logging 埠被占用時，依序選取鄰近可用埠，產生本次啟動專用的暫存 Firebase config，並把 Auth／Firestore 實際埠傳給 Vite。
- 將 Firebase CLI 的 `XDG_CONFIG_HOME` 暫指向本次 runtime 暫存目錄，避免碰觸使用者全域設定；結束時還原並清理暫存資料。
- 使用 ASCII 頁面標記，避免 Windows PowerShell 5.1 誤讀 UTF-8 中文字串。
- 對未能確認為本專案的 Vite `3100` 占用，列出 PID／程序名稱並停止啟動；不終止程序。
- Test／E2E 維持原本獨立啟動與清理行為。

驗收標準：同專案 runtime 不因重複呼叫而重啟；Firestore 等 Emulator 預設埠被占用時改用可用埠並正常提供服務；未知程序不被終止，Vite 埠錯誤訊息可識別 PID／程序名稱。

Spec Impact Preflight：`No product contract impact`。只變更本機啟動器與 README 操作說明。

驗證結果：PowerShell AST 語法解析、`git diff --check` 與 `npm run dev:local` 啟動／重用 smoke 通過。Windows PowerShell 7.6.5 在 Firestore `8080` 與 Emulator UI `4000` 被外部程序占用時改用可用替代埠；HTTP `/cases` 回應 200，Hub 回報 Auth `9099`／Firestore `8081`，重複執行辨認並重用同專案 Emulator／Vite。外部程序未終止；runtime 依使用者「開始執行」要求保持運作，清理 owner 為本任務。未執行測試套件。

### DEV-030｜全系統「算法依據」用語統一

狀態：`已部署 / Local Gates Passed / Production Static Smoke Passed / Browser Visual QC Not Verified`

節點類型：開發點

父交付點：DEV-028

是否計入產品交付完成：否

原始需求邊界：將報告中的「計算依據」改為「算法依據」，並要求其他地方一併統一。

範圍：報告摘要與參數標籤、計算狀態提示、工作台說明、有效規格與驗收文件；不變更算法、公式、參數、資料結構或歷史任務紀錄。

驗收標準：所有目前產品程式不再輸出「計算依據」；報告摘要、工作台提示、缺軌提示與參數標籤均顯示「算法依據」；計算結果與資料契約不變。

風險等級：`Low`

Spec Impact Preflight：`Intentional terminology update`。程式與有效 SPEC／ADR／QC 已同步；計算、公式、參數及資料契約不變。

驗證結果：格式、型別、受影響檔案 lint、production build 與 `git diff --check` 通過。Unit tests 未執行。

正式 Hosting 已部署；root、報告 route 與規則 route 均回應 HTTP 200，線上 JavaScript bundle 包含「算法依據」且不含舊用語。Browser screenshot QC 未充分驗證：CUA Node process 連續兩次意外退出；使用者既有分頁未操作，沒有新增或修改正式案件資料。

### DEV-029｜案件歷史版本保留與唯讀查看

狀態：`完成 / Local Verified / Production Feature Smoke Passed`

開發文件成熟度：`RD Implementation Ready`

架構定案：`已定案`

節點類型：交付點

父交付點：無

是否計入產品交付完成：是

原始需求邊界：使用者在案件清單只看得到最新的「版本 2」，明確要求能查看歷史版本並先寫開發文件，之後要求「繼續補到架構確定」；本輪依已定案契約完成產品實作、提交並發布正式 Rules／Hosting，並在取得一次性授權後以可辨識 production fixture 完成完整 history smoke，驗證後已清理。

風險等級：`Medium`

#### Human Decision Brief

- `1A`：刪除案件時，永久刪除目前版本與所有歷史版本，不改成封存流程。
- `2B`：歷史版本可用目前報告版型重新輸出 PDF，但畫面、文件與檔名都必須標示「重新產生」，不得宣稱是當時原始 PDF。
- Rejected：`1B` 封存案件；`2A` 第一版僅唯讀、不提供 PDF。
- 決策來源：使用者於 2026-09-21 以引導短碼 `1A 2B` 明確選定。

#### 任務目標

建立新版本後，舊版本不得再被最新資料覆寫；使用者可從正常案件入口找到同一案件的版本紀錄，並以唯讀方式查看當時保存的案件輸入、計算結果與報告資料。最新版本仍是唯一可編輯版本；歷史版本可依目前版型重新輸出 PDF，但必須清楚揭露這不是當時的原始輸出。

#### Current Architecture Impact

- 現行 Firestore 只有 `cases/{caseGroupId}` 單一 aggregate document；建立新版本會直接覆寫該文件並清除舊計算與報告資料。
- 本功能新增「目前案件 head + 分離的不可變歷史快照」資料概念，影響 repository、revision transaction、Rules、routes、案件清單、工作台與報告輸出。
- 專案仍維持 Firebase Spark 純靜態 SPA、Anonymous Auth 與共享案件模型；不新增 server runtime、Storage、角色或核發流程。

#### Document Ownership

- [ADR-012](decisions/ADR-012-immutable-case-revision-subcollection.md)：唯一架構權威；負責 storage path、atomic transaction、Rules invariants、`DELETING` 刪除協定與已接受風險。
- [SPEC-003](specs/SPEC-003-case-version-history.md)：唯一產品契約；負責 routes、可見狀態、唯讀邊界、錯誤恢復與 acceptance。
- [QA-002](qa/QA-002-case-version-history.md)：唯一驗證契約；負責 fixtures、FMEA、測試案例、gate commands 與 evidence。
- 本節只管理執行狀態、切片順序、交接邊界與 re-entry；不得在此複製三份權威文件的細節。

#### Implementation Slices

1. `Data + Rules`：擴充 `case-store.ts`／`firestore-case-store.ts` 的 archive、history 與 deletion APIs；更新 `firestore.rules`，不改 `firestore.indexes.json`。
2. `Application`：改寫 `revision-service.ts` 走 atomic archive；在 `repository.ts` 接上 idempotent delete；新增 `history-service.ts` 與歷史 report service。
3. `Routes + UI`：更新 `app-router.tsx`；新增 history list／detail／report views；`cases-list.tsx`、`case-workbench.tsx` 增加正常入口與 `DELETING` 狀態。
4. `Report provenance`：在 `domain/report/html.ts` 與 report preview 純呈現層加入 `REGENERATED_HISTORY`，不得改 archive snapshot。
5. `Verification`：完成 unit、Rules integration、format、lint、typecheck、build；另以 task-owned 8180／9199 emulator 與 3210 Vite 完成 desktop／tablet／mobile Playwright E2E，測試後清理 runtime。

#### Architecture Handoff

- 可直接決定：模組內命名、純重構、測試 helper 與不改變契約的元件拆分。
- 不可自行改變：資料路徑、exact snapshot、transaction 邊界、Rules 關係、routes、`DELETING` lifecycle、PDF provenance 或既有資料相容策略。
- 若必須改用 embedded history、非原子 copy、靜默截斷、可信任 backend 或新增計費服務，停止實作並回 ADR-012 review。
- UI 採最小入口：案件列表以版本文字或單一「歷史版本」連結進入，不新增重複 action 欄；工作台只增加一個次要入口；刪除中只顯示一個「繼續刪除」恢復動作。

#### Out of Scope

- 還原目前已被覆寫且沒有外部備份的歷史內容；不得依版本號推測或捏造版本 1。
- 保存或下載「當時原始 PDF」；本階段只允許以目前版型重新產生並清楚標示。
- 歷史版本逐欄差異比較、紅線標示、變更原因紀錄、還原為目前版、分支版本或複製成新案件。
- 匯入舊 PDF、外部備份或其他系統紀錄來重建歷史版本。
- 改變 Anonymous Auth、共享案件模型、核發流程或新增其他正式環境／provider／migration；本次 release 依既定 gate 另行記錄。

#### Acceptance Summary

- 建版原子保留舊版，且只有目前版可編輯；歷史版 direct URL 可唯讀重載。
- 歷史報告只用 archive snapshot，並在預覽、本文及檔名標示「重新產生」。
- 刪除永久涵蓋 head 與全部 archives；失敗可續跑，完成前不得宣稱成功。
- 缺失的早期版本明示「早期版本未保留」，不得補值或偽造。
- 1440／1024／390 的正常、loading、empty、missing、error 與 deleting 狀態均可辨識且無頁面水平溢出。
- 完整 acceptance 以 SPEC-003 為準；驗證案例與證據以 QA-002 為準。

#### Release Impact Note

本功能已依 release gate 發布 Firestore Rules 與 Hosting；Firestore 歷史資料契約、SPA routes 及 client transaction 行為均隨 commit `2e1d261` 發布。production Auth／Firestore 唯讀 boundary 與完整 history flow 均已以 CLI browser smoke 驗證：使用者明確授權的一次性 production fixture 完成建版、封存、歷史唯讀、歷史報告重新產生與整案刪除，清理後無殘留資料。未執行 production migration；本次寫入僅限該一次性測試資料且已透過產品刪除流程清除。

#### Execution Boundary

本文件已達 `RD Implementation Ready`，且架構已定案；DEV-029 已完成本機實作與可重現驗證，commit `2e1d261` 已發布正式 Rules／Hosting。未執行 production migration 或正式案件寫入／刪除。

驗證結果：

| Gate                                             | 狀態                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit tests                                       | Passed: 11 files / 51 tests                                                                                                                                                                                                                                                                               |
| Firestore Rules／repository integration          | Passed: 1 file / 7 tests                                                                                                                                                                                                                                                                                  |
| format check                                     | Passed                                                                                                                                                                                                                                                                                                    |
| lint                                             | Passed                                                                                                                                                                                                                                                                                                    |
| typecheck                                        | Passed                                                                                                                                                                                                                                                                                                    |
| production static build                          | Passed: 160 modules                                                                                                                                                                                                                                                                                       |
| production Rules deploy                          | Passed: `firestore.rules` compiled and released to `jenfu-grease-trap-calculator`                                                                                                                                                                                                                         |
| production Hosting deploy                        | Passed: `https://jenfu-grease-trap-calculator.web.app`; published asset matches local `dist` hash                                                                                                                                                                                                         |
| production static smoke                          | Passed: canonical `/` and SPA `/cases/production-smoke-route` returned 200; title and asset hash matched                                                                                                                                                                                                  |
| production authenticated read-only smoke         | Passed: anonymous Auth succeeded; `/cases` loaded 9 records; all 9 existing `/history` routes loaded and correctly showed `尚無歷史版本`; current production report route loaded expected headings/results; Playwright console reported 0 errors／warnings                                                |
| production archived-history detail／report smoke | Passed: explicit one-time disposable fixture created through UI; version 1 archived when version 2 was created; history list／read-only detail／history report regeneration passed in compact and complete modes; deletion removed head + archive and both direct routes then showed `找不到這筆共享案件` |
| production smoke transport note                  | Two late Firestore Listen `ERR_QUIC_PROTOCOL_ERROR.QUIC_NETWORK_IDLE_TIMEOUT` console entries appeared after 172s／208s idle connection timeouts; no page error, runtime error, failed user operation, or data-integrity symptom was observed                                                             |
| production report-setting label smoke            | Passed: fresh cache-busted production route displayed `精準計算-只計算此次目的` and `完整計算-連相關參考資訊皆計算`; calculation/report output unchanged                                                                                                                                                  |
| Playwright E2E                                   | Passed: desktop-1440、tablet-1024、mobile-390；含歷史清單、唯讀明細、歷史報告重新產生預覽                                                                                                                                                                                                                 |
| `git diff --check`                               | Passed                                                                                                                                                                                                                                                                                                    |
| task-owned runtime cleanup                       | Passed: 8180／9199／3210 released; temp config removed                                                                                                                                                                                                                                                    |

Spec Impact Preflight：`Intentional replacement`。SPEC-003 定義預計取代 SPEC-001「建立新版本只更新單一案件 aggregate 並清除舊資料」的未來契約；在產品尚未實作前，SPEC-001 仍描述目前行為。ADR-012 鎖定新資料與交易架構；ADR-009 的 Spark、Anonymous Auth 與 client-only 邊界維持不變。

ADR 判定：已新增 ADR-012，因 storage path、atomic transaction、deletion recovery 與 report provenance 是跨模組且難以逆轉的長期決策。若未來改採可信任 backend，再建立新 ADR；不得直接改寫 ADR-012 的威脅模型。

相關文件：ADR-012、SPEC-003、QA-002、SPEC-001 第 5～8 節、SPEC-002 第 4／6／7 節、ADR-009、ADR-010、DEV-021。

變更紀錄：

- 2026-09-21：依使用者明確要求建立 `Brief Ready`；記錄正常 UI 入口、唯讀歷史、未來保存邊界及既有版本無法憑空還原的限制。
- 2026-09-21：記錄引導決策 `1A 2B`，補齊資料、權限、UI、刪除、歷史 PDF、錯誤恢復與 evidence 契約，升級為 `RD Contract Ready`。
- 2026-09-21：依「繼續補到架構確定」完成 ADR-012、exact CaseDocument archive、Rules `getAfter` 雙向交易、`DELETING` 可重試刪除、歷史 report provenance、implementation slices 與 QA-002，升級為 `RD Implementation Ready`；本輪未實作產品功能。
- 2026-09-21：依 RD 技術主管審查收斂文件責任，DEV 只保留執行切片與交接邊界；架構、產品契約與驗證分別以 ADR-012、SPEC-003、QA-002 為唯一權威。
- 2026-09-21：完成 DEV-029 Data／Rules、application、history routes／UI、歷史報告 provenance 與 resumable delete；51 unit、7 Firestore integration、desktop／tablet／mobile Playwright E2E、format、lint、typecheck、build 通過。E2E 使用 task-owned 8180／9199／3210 runtime，測試後已釋放。
- 2026-09-22：依使用者要求提交 commit `2e1d261`，發布 `firestore.rules` 與 `dist/` 至 `jenfu-grease-trap-calculator`；canonical static smoke 與 asset provenance 通過。修正 smoke runner 採 `domcontentloaded` 加明確 DOM readiness，production Auth／Firestore read-only boundary 通過：`/cases` 9 筆、9 個 history route 均正確呈現 `尚無歷史版本`、目前案件 report route 載入。取得使用者一次性正式測試資料授權後，建立 `GTC-260922-01`／`HISTORY-FLOW-SMOKE-ONE-TIME`，完成 REPORT_DRAFT、版本 2 建立、歷史清單／唯讀明細／精簡與完整歷史報告重新產生，接著刪除整案；刪除後 current／history direct URL 均回報找不到共享案件，確認 head 與 archive 已清理。測試未留下正式資料；長時間 listener 只記錄兩筆 late QUIC idle timeout，未影響功能操作。
- 2026-10-01：依使用者回饋將報告設定文案更新為「精準計算-只計算此次目的」與「完整計算-連相關參考資訊皆計算」；commit `8492a34` 通過 format、lint、typecheck、51 unit tests、build，已發布 Hosting，cache-busted production route 驗證新文案生效。

### DEV-028｜報告計算任務與參考計算視覺分層

狀態：`Complete / Local Verified`

節點類型：開發點

父任務：DEV-024

是否計入產品交付完成：否

原始需求邊界：使用者要求在第 3 章「本次設計結果」增加計算目的的最終值重點標示；其後要求第 4 章保留既有順暢計算順序與全部計算內容，只以 UI／文字輔助區分需求重點與參考資料。

風險等級：`Low`

開發範圍：

- 先依案件 `taskCode` 判斷本次計算任務，再只對該任務所對應的 `VALUE` 輸出儲存格加上淡藍底、左側主色線與數值層級。
- 流量任務只強調「設計處理水量」；設計需求任務強調流量、油脂量及有效容積；反推任務強調可支援人數與面積。
- 預設報告只列出與本次計算任務直接相關的輸入、結果及計算步驟，避免參考計算模糊主結果。
- `NOT_COMPLETED` 與 `NOT_APPLICABLE` 維持原有狀態文字、色彩與弱化層級，不將缺值誤標為最終值。
- 報告預覽上方的「報告設定」提供二選一：`精準計算-只計算本次計算任務`、`完整計算-包含參考計算`，預設選擇精準計算；報告本文內不放切換控制或展開按鈕。
- 選擇完整計算時，依原有順序靜態列出完整輸入、結果與計算步驟，不改變計算順序。
- 完整計算模式在每個算法首次進入參考步驟前顯示「以下為參考計算」靜態分隔線；精簡計算模式不顯示該分隔線。
- 草稿預覽、草稿 PDF 與正式 PDF 均使用當下選定的報告設定；設定只影響呈現，不改變案件或計算資料。
- 第 4 章只對本次計算任務的最終結果加上淡藍底與左側主色線；參考計算結果維持一般層級。
- 設備能力反推人數同時產生流量與油脂兩個候選上限時，只強調實際控制（較小）的候選值，避免把非控制條件誤認為最終值。
- 只調整報告組裝與 UI 呈現，不改變計算公式、採用值、snapshot schema 或輸出資料契約。

驗收標準：

- 預設報告的第 2～4 章只列出符合本次計算任務的資訊，且不增加重複文字。
- `T01`、`T03`、`T06` 只強調設計處理水量；其他結果即使有值也不得升級為主焦點。
- 無法計算與未完成狀態不帶最終值強調樣式。
- 報告外層提供上述二選一設定且預設為精準計算；報告本文不出現任何互動控制。
- 選擇精準計算時，T01/T03 的參考輸入、非主要任務結果列與參考計算步驟不出現在報告中，第 4 章標題為「本次計算任務過程」。
- 選擇完整計算後，參考輸入、非目的結果列與參考計算步驟皆按原順序靜態呈現，第 4 章標題為「完整計算過程」。
- 選擇完整計算後，每個含參考步驟的算法只在首次進入參考內容前顯示一次「以下為參考計算」分隔線。
- 草稿與正式 PDF 必須跟隨當下設定，不可因輸出流程重新加入或遺漏參考資訊。
- 桌機與 390px 窄版不產生 overflow；列印樣式沿用同一視覺層級。
- unit、typecheck、targeted lint、build 與實際瀏覽器畫面 QC 通過。

Spec Impact Preflight：`No contract drift`。本次只調整報告 HTML/CSS 呈現，不需修改 SPEC-001 或新增 ADR。

相關文件：DEV-024、SPEC-001。

變更紀錄：

- 2026-09-21：修正「建立新版本」在應用內瀏覽器中缺乏可見反應的問題，改為頁面內確認區塊，保留確認／取消流程與既有版本建立邏輯。
- 2026-09-21：依使用者回饋統一案件清單各欄位次要資訊的區塊顯示與行高，修正版本、地點與模式文字未對齊的問題。
- 2026-09-21：依使用者回饋微調案件清單排版，穩定欄位比例、收斂列距，並保留行動版卡片式呈現。
- 2026-09-21：依使用者審視回饋，為第 3 章可用最終輸出值增加背景、左側重點線與數值層級。
- 2026-09-21：修正判斷基準；由「所有有值輸出」改為「符合案件 taskCode 的主輸出」，T01 僅強調設計處理水量。
- 2026-09-21：第 4 章保留原步驟順序與全部計算內容，新增需求目的提示及「本次目的／參考計算」標示，且只加強目的最終值。
- 2026-09-21：依使用者選定方案 B，移除每一步的行內標籤，改為每種算法首次進入參考內容時只顯示一次「以下為參考資訊, 與此次計算目的無關」分界。
- 2026-09-21：依使用者審視回饋，放大參考分界字體並增加上方留白。
- 2026-09-21：依使用者審視回饋，草稿參考資訊改為每算法一個原生折疊區，預設收起；正式報告靜態呈現，列印強制保留參考內容。
- 2026-09-21：依使用者最終回饋，移除報告本文內的參考資訊按鈕；改由報告外層「報告設定」決定是否納入參考計算，預設只輸出需求目的資訊，草稿與正式 PDF 同步套用。
- 2026-09-21：依使用者回饋，將報告設定改為互斥二選一，顯示「精簡計算-只計算此次目的」與「完整計算-連同參考資訊一同完整計算」，避免核取方塊語意不清。
- 2026-10-01：依使用者回饋，將報告設定文案更新為「精準計算-只計算此次目的」與「完整計算-連相關參考資訊皆計算」；僅調整可見文案，不改變計算與報告呈現邏輯。
- 2026-10-01：依使用者回饋移除規則清單的開發者術語；臺北市來源改顯示「原始文件未標示版次」，不在畫面揭露 `legacy.1` 內部識別碼，原始識別碼仍保留於資料與計算追溯。
- 2026-10-01：依使用者回饋將無版次的規則清單顯示簡化為「無」。
- 2026-10-01：依官方函文查證臺北市來源原始發布日為 2008/08/11，將日期寫入規則清單版本欄。
- 2026-10-01：依內政部官方修正令查證附錄 5 來源日期為 2020/07/10，將第二列版本欄同步改為日期格式。
- 2026-10-01：依使用者回饋將規則清單拆為「版本／發布日期」兩欄；兩套來源版本皆顯示「無」，日期獨立呈現並保留內部規則識別碼。
- 2026-10-01：依使用者回饋將規則清單第一欄改為「文件名稱」，移除文件名稱中的算法前綴，並新增備註欄標示「本系統算法A／本系統算法B」。
- 2026-10-01：依使用者回饋收斂規則清單桌機欄寬；改採內容寬度並限制長文件名稱／來源換行，避免空白欄位撐開水平捲軸。
- 2026-10-01：依使用者確認的統整表，將目前介面與報告的計算類型統一稱為「計算任務」、報告主要範圍稱為「本次計算任務」、補充步驟稱為「參考計算」；同步更新 SPEC-001、SPEC-002、QC-001 與報告文案斷言。commit `7b72bee` 通過格式檢查、修改檔 ESLint 與 build，已發布 Hosting；正式報告路由與 JS 資產回應 200，資產含五處新文案。未執行 unit suite；Playwright／UI 執行器受 Windows 權限阻擋，因此沒有畫面截圖驗證。
- 2026-09-21：依使用者回饋，將原參考資訊分隔線恢復至完整計算模式；精簡計算模式維持不顯示。
- 2026-09-21：依使用者回饋，將報告操作改為「儲存草稿版本／輸出草稿 PDF／輸出正式 PDF」，並將保存動作與 PDF 輸出動作分組呈現。
- 2026-09-21：依使用者回饋收斂報告水平線；移除案件摘要上緣、各算法第一步上緣及參考分界後的重複線條，保留章節、算法與參考資訊所需的單一分界。
- 2026-09-21：依使用者回饋移除每個大章節標題的底線，改以標題字級、留白與內容分組維持章節層級。
- 2026-09-21：依使用者回饋移除算法步驟區塊與下一算法之間的底線，保留留白以維持計算順序與分組辨識。
- 2026-09-21：依使用者回饋移除所有計算步驟之間的橫線，改以留白與步驟標題維持閱讀順序；參考資訊文字分隔線保留。
- 2026-09-21：依使用者回饋將報告案件資料中的「修訂」文案改為「版本」，保留原版本數值與資料邏輯。
- 2026-09-21：依使用者回饋將第 1 章案件資料摘要由彈性文字區塊改為「項目／內容」表格，保留原欄位與順序。
- 2026-09-21：依使用者回饋將第 4 章算法標題統一改為「使用算法B-…／使用算法A-…」，避免「計算依據」與實際算法識別混淆。
- 2026-09-21：依使用者回饋將案件資料表改為雙組並排、內容靠左，將 5 列摘要壓縮為 3 列並保留欄位順序。
- 2026-09-21：依使用者回饋將算法顯示與輸出排序統一為算法A（臺北市工務局衛工處設計說明）後算法B（內政部給排水規範附錄 5），涵蓋規則清單、模式選擇、輸入欄、結果比較與報告章節。
- 2026-09-21：修正第 2 章輸入表的長文字值繼承數值欄不換行而跨越相鄰儲存格；長理由現在在原欄位內換行。
- 2026-09-21：依使用者回饋移除第 1 章案件資料表的「項目／內容」標題列，保留案件資料列與左右雙組結構。
- 2026-09-21：依使用者回饋將完整計算模式的參考資訊分隔線改為左右對稱、文字置中的版式。
- 2026-09-21：依使用者回饋將計算步驟的 L/min 結果統一以一位小數四捨五入，與結果比較表的顯示一致。
- 2026-09-21：依使用者回饋將整個使用者介面的「修訂」文案統一改為「版本」，涵蓋案件清單、工作台、確認訊息與錯誤訊息。

驗證結果：

| Gate                    | 狀態                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| unit tests              | Passed: 10 files / 48 tests                                                                                                |
| typecheck               | Passed                                                                                                                     |
| targeted lint           | Passed: 報告 HTML、service、preview UI 與單元測試                                                                          |
| production static build | Passed: 156 modules                                                                                                        |
| UI desktop／390         | Passed: 預設選精準計算；切換完整計算後參考資訊依原序出現並顯示分隔線；二選一互斥、無展開按鈕且無 overflow                  |
| 視覺證據                | Playwright live route `/cases/bee53ded-12aa-4c4c-b9fc-94edb4ff7c09/report` 桌機與 390px 截圖、兩種設定狀態、DOM 與寬度量測 |
| runtime cleanup         | Passed: task-owned Playwright browser closed；既有 port 3100 與使用者分頁保留                                              |
| full-repo lint          | Baseline fail: 4 個既有 `react-hooks/set-state-in-effect`，不在本次修改檔案                                                |
| `git diff --check`      | Passed                                                                                                                     |

Spec Drift / Convergence Check：`In sync`。本次為呈現層優化，計算與報告輸出契約沒有變更。

### DEV-024｜報告改為不同計算方式對照版型

狀態：`Complete / Local Verified`

節點類型：交付點

父交付點：DEV-022

是否計入產品交付完成：是

原始需求邊界：使用者審視三份「不同計算方式對照」原型後，明確要求依該方法執行優化。

風險等級：`Medium`

開發範圍：

- 報告第 3 章保留各計算依據的採用值對照。
- 第 4 章依各計算依據呈現連續步驟，步驟目的文字保留設計處理水量、清除週期油脂量、有效容積、人數與面積的辨識資訊。
- 個別公式改列「步驟 1、步驟 2」，不再生成 `4.1.1` 類公式章節。
- 只有 L/h 結果需要列出 L/min 換算；原生 L/min 結果不得重複顯示相同換算值。
- T06 保持臺北市 Q/V 單軌，不捏造內政部 Q/G 對應公式。

驗收標準：

- 雙軌人數、面積與反推案件均以相同資訊骨架呈現兩套依據。
- 各連續步驟保留公式、代入內容、數值算式、原始結果與必要單位換算；不重複列出第 3 章已呈現的採用值，也不顯示結果主題小標。
- 報告 HTML 不含公式型子章編號，未知公式仍以安全的「其他計算」群組呈現。
- targeted unit、typecheck、build 與 1440／390 實際畫面 QC 通過。

Spec Impact Preflight：`Intentional replacement`。DEV-022 原「公式步驟延伸為 4.1.1」契約由本 DEV 取代；正式報告輸出、編號、snapshot 與列印流程不變。

相關文件：SPEC-001、DEV-022。

變更紀錄：

- 2026-09-21：依使用者核准的審稿原型建立任務並進入 RD。
- 2026-09-21：完成結果主題分組、公式步驟降階、必要單位換算、T06 單軌邊界及面積法語意修正。
- 2026-09-21：依審視回饋移除第 4 章各結果主題的重複採用值，只保留公式步驟計算結果。
- 2026-09-21：依審視回饋移除第 4 章結果主題小標，改為各計算依據的連續步驟。
- 2026-09-21：依審視回饋縮小「代入內容」標籤字級，使其與其他步驟欄位標籤一致。

驗證結果：

| Gate                    | 狀態                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| unit tests              | Passed: 9 files / 45 tests                                                                                                                 |
| typecheck               | Passed                                                                                                                                     |
| targeted lint           | Passed: `src/domain/report/html.ts`、`tests/unit/report-html.test.ts`                                                                      |
| production static build | Passed: 156 modules                                                                                                                        |
| UI 1440／390            | Passed: 1440 人數／面積／反推／T06；390 人數／T06；無 overflow、visible error、console error                                               |
| 視覺證據                | `output/playwright/dev-024-*.png`、`output/playwright/dev-025-*.png`、`output/playwright/dev-026-*.png`、`output/playwright/dev-027-*.png` |
| runtime cleanup         | Passed: task-owned browser closed、port 3110 released；既有 port 3100 未觸碰                                                               |
| full-repo lint          | Baseline fail: 4 個既有 `react-hooks/set-state-in-effect`，不在本次修改檔案                                                                |
| `git diff --check`      | Passed                                                                                                                                     |

Spec Drift / Convergence Check：`In sync`。實作、SPEC-001、DEV-024 與驗收一致；ADR-010 的正式輸出、編號、snapshot 與列印決策未變，不需新增 ADR。

### DEV-023｜有效容積換算設計處理水量

狀態：`Complete / Production Verified`

風險等級：`Medium`

執行邊界：本機程式、測試、規格與 UI 驗證；另完成正式 Firebase Rules/Hosting 發布，不修改既有正式案件，僅使用可刪除 smoke fixture。

驗收標準：

- 建案頁新增「我知道設備有效容積，要換算設計處理水量」。
- 選取後只允許算法 A；schema 與 Firestore Rules 也拒絕其他模式。
- 工作台只要求有效容積與資料來源；`500 L` 顯示 `50 L/min`。
- 報告保留輸入、來源、`Qhour=6×Veff` 與 L/min 單位換算。
- targeted unit、typecheck、Rules integration、build 與 1440／390 UI QC 通過。

相關文件：ADR-011、SPEC-001、SPEC-002、QA-001、QC-001。

驗證結果：

| Gate                          | 狀態                                |
| ----------------------------- | ----------------------------------- |
| typecheck                     | Passed                              |
| unit tests                    | Passed: 9 files / 41 tests          |
| Rules／repository integration | Passed: 1 file / 6 tests            |
| production static build       | Passed: 156 modules                 |
| UI 1440／390                  | Passed: no overflow／visible error  |
| report formula trace          | Passed: 500 L → 3000 L/h → 50 L/min |
| test data／browser cleanup    | Passed                              |

本變更已部署至 DEV-012 的獨立 Firebase project；正式 Hosting smoke 已驗證 T06、報告內容與列印 fallback。

### DEV-022｜無核發流程的正式報告輸出

狀態：`Complete / Production Verified`

決策：任何使用者都可直接產出正式報告；不建立送審、覆核、核准、角色或核發狀態。草稿與正式報告沿用同一 snapshot，正式版直接使用案件編號 `GTC-YYMMDD-00` 與案件修訂版次。

已完成：

- 報告頁新增 primary CTA「產生正式報告」，既有動作改名為「產生草稿 PDF」。
- 尚未保存草稿時，正式報告動作會先保存當下 snapshot。
- 案件與正式報告共用 `GTC-YYMMDD-00`，已刪除 `RDR-` 轉換邏輯；檔名只附加 `RNN` 版次。
- 正式 PDF 移除草稿標記，封面與頁首顯示報告編號及版次。
- 本機 Vite preview 的 PDF helper 可保存至測試輸出資料夾；正式 Hosting 使用相同正式 HTML 開啟瀏覽器列印視窗，提示使用者另存為 PDF。
- 報告「案件資料」改為緊湊的標籤／值排列；客戶、設置地點、需求目的與計算依據資訊完整保留，不再使用逐列大型表格。
- 報告標題改為實際文字章節編號：`1`～`4` 為主章，計算依據為 `2.1`／`4.1`；當時的公式子章編號已由 DEV-024 連續步驟版型取代。
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

本變更已部署至 DEV-012 的獨立 Firebase project；正式 Hosting smoke 已驗證 T06、報告內容與列印 fallback。

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
