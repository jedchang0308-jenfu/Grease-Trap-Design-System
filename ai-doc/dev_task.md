# DEV 任務總表｜油脂截留器雙軌計算系統

文件狀態：`DEV-029 已完成 / 已部署；production feature smoke 通過`

版本：`5.32`

最後更新：`2026-09-22`

## 總任務清單

- ✓ DEV-029 [交付點] [完成] [P1] [已發版] 案件歷史版本保留與唯讀查看
  - 摘要：建立新版本前保留舊版，提供同案版本紀錄與唯讀查看；刪除涵蓋全部版本，歷史報告可依目前版型標示後重新輸出。
  - 來源 ID：使用者要求「我要可以看歷史版本，請寫開發文件」
  - 下一步：無；後續涉及歷史資料契約、Rules 或報告 renderer 的變更，沿用本次 production feature smoke 並重新執行清理確認。
  - 證據：ADR-012、SPEC-003、QA-002、commit `2e1d261`、Rules／Hosting deploy、51 unit、7 Firestore integration、3 viewport Playwright E2E、lint、format、typecheck、build、static production smoke、production Auth／Firestore read-only smoke、一次性授權 production fixture 完整 history smoke 與清理證據
  - 計入交付：是

- ✓ DEV-028 [開發點] [完成] [P2] [本機完成] 報告計算目的與參考資料視覺分層
  - 摘要：報告預設只輸出需求目的相關的輸入、結果與計算步驟；是否納入其餘參考計算改由報告外層設定，產出的報告本文不含展開按鈕或參考分界文字。
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

| Gate | 狀態 |
| --- | --- |
| unit tests | Passed: 11 files / 51 tests |
| Firestore Rules／repository integration | Passed: 1 file / 7 tests |
| format check | Passed |
| lint | Passed |
| typecheck | Passed |
| production static build | Passed: 160 modules |
| production Rules deploy | Passed: `firestore.rules` compiled and released to `jenfu-grease-trap-calculator` |
| production Hosting deploy | Passed: `https://jenfu-grease-trap-calculator.web.app`; published asset matches local `dist` hash |
| production static smoke | Passed: canonical `/` and SPA `/cases/production-smoke-route` returned 200; title and asset hash matched |
| production authenticated read-only smoke | Passed: anonymous Auth succeeded; `/cases` loaded 9 records; all 9 existing `/history` routes loaded and correctly showed `尚無歷史版本`; current production report route loaded expected headings/results; Playwright console reported 0 errors／warnings |
| production archived-history detail／report smoke | Passed: explicit one-time disposable fixture created through UI; version 1 archived when version 2 was created; history list／read-only detail／history report regeneration passed in compact and complete modes; deletion removed head + archive and both direct routes then showed `找不到這筆共享案件` |
| production smoke transport note | Two late Firestore Listen `ERR_QUIC_PROTOCOL_ERROR.QUIC_NETWORK_IDLE_TIMEOUT` console entries appeared after 172s／208s idle connection timeouts; no page error, runtime error, failed user operation, or data-integrity symptom was observed |
| Playwright E2E | Passed: desktop-1440、tablet-1024、mobile-390；含歷史清單、唯讀明細、歷史報告重新產生預覽 |
| `git diff --check` | Passed |
| task-owned runtime cleanup | Passed: 8180／9199／3210 released; temp config removed |

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

### DEV-028｜報告計算目的與參考資料視覺分層

狀態：`Complete / Local Verified`

節點類型：開發點

父任務：DEV-024

是否計入產品交付完成：否

原始需求邊界：使用者要求在第 3 章「本次設計結果」增加計算目的的最終值重點標示；其後要求第 4 章保留既有順暢計算順序與全部計算內容，只以 UI／文字輔助區分需求重點與參考資料。

風險等級：`Low`

開發範圍：

- 先依案件 `taskCode` 判斷本次計算目的，再只對目的所對應的 `VALUE` 輸出儲存格加上淡藍底、左側主色線與數值層級。
- 流量任務只強調「設計處理水量」；設計需求任務強調流量、油脂量及有效容積；反推任務強調可支援人數與面積。
- 預設報告只列出與需求目的直接相關的輸入、結果及計算步驟，避免參考資訊模糊主結果。
- `NOT_COMPLETED` 與 `NOT_APPLICABLE` 維持原有狀態文字、色彩與弱化層級，不將缺值誤標為最終值。
- 報告預覽上方的「報告設定」提供二選一：`精簡計算-只計算此次目的`、`完整計算-連同參考資訊一同完整計算`，預設選擇精簡計算；報告本文內不放切換控制或展開按鈕。
- 選擇完整計算時，依原有順序靜態列出完整輸入、結果與計算步驟，不改變計算順序。
- 完整計算模式在每個算法首次進入參考步驟前顯示「以下為參考資訊, 與此次計算目的無關」靜態分隔線；精簡計算模式不顯示該分隔線。
- 草稿預覽、草稿 PDF 與正式 PDF 均使用當下選定的報告設定；設定只影響呈現，不改變案件或計算資料。
- 第 4 章只對需求目的的最終結果加上淡藍底與左側主色線；參考計算結果維持一般層級。
- 設備能力反推人數同時產生流量與油脂兩個候選上限時，只強調實際控制（較小）的候選值，避免把非控制條件誤認為最終值。
- 只調整報告組裝與 UI 呈現，不改變計算公式、採用值、snapshot schema 或輸出資料契約。

驗收標準：

- 預設報告的第 2～4 章只列出符合本次需求目的的資訊，且不增加重複文字。
- `T01`、`T03`、`T06` 只強調設計處理水量；其他結果即使有值也不得升級為主焦點。
- 無法計算與未完成狀態不帶最終值強調樣式。
- 報告外層提供上述二選一設定且預設為精簡計算；報告本文不出現任何互動控制。
- 選擇精簡計算時，T01/T03 的參考輸入、非目的結果列與參考計算步驟不出現在報告中，第 4 章標題為「需求目的計算過程」。
- 選擇完整計算後，參考輸入、非目的結果列與參考計算步驟皆按原順序靜態呈現，第 4 章標題為「完整計算過程」。
- 選擇完整計算後，每個含參考步驟的算法只在首次進入參考內容前顯示一次「以下為參考資訊, 與此次計算目的無關」分隔線。
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
| UI desktop／390         | Passed: 預設選精簡計算；切換完整計算後參考資訊依原序出現並顯示分隔線；二選一互斥、無展開按鈕且無 overflow                  |
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
