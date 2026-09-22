# SPEC-003｜案件歷史版本保留與唯讀查看

文件狀態：`RD Implementation Ready / 已發版；production feature smoke 通過`

架構定案：`已定案`

版本：`1.3`

日期：`2026-09-22`

關聯任務：`DEV-029`

## 1. Purpose

目前案件以單一 Firestore aggregate 保存；建立新版本會在同一 document 更新版號並清除原有輸入、計算與報告，因此使用者無法返回查看舊版。本規格定義版本保存、唯讀查看、永久刪除及歷史報告重新輸出的可實作產品與技術契約。

本文件已完成可實作架構契約；DEV-029 已完成產品程式與 Rules 實作及自動化驗證，commit `2e1d261` 已發布正式 Rules／Hosting。production Auth／Firestore read-only boundary 與歷史 feature flow 已驗證；本次使用者明確授權的一次性 production fixture 完成版本封存、歷史唯讀、歷史報告重新產生與整案清理，未執行 production migration 且未留下正式資料。

## 2. Human Decision Brief

| 題號 | 使用者決策                               | 契約影響                                   |
| ---- | ---------------------------------------- | ------------------------------------------ |
| 1A   | 刪除案件時永久刪除目前版本與全部歷史版本 | 延續既有刪除語意，不建立封存清單或保留層   |
| 2B   | 歷史版本可用目前版型重新輸出 PDF         | 必須標示「重新產生」，不得稱為當時原始 PDF |

決策來源：使用者於 2026-09-21 以引導短碼 `1A 2B` 明確選定。

Rejected options：刪除改為封存；第一版僅唯讀且不提供 PDF。

## 3. Product Contract

### 3.1 Current and historical versions

- 每個 `caseGroupId` 同時只能有一個目前版本；只有目前版本可以編輯、重新計算、儲存報告或建立下一版。
- 每次建立新版前，系統保存目前版本的完整 immutable snapshot；完成後才建立下一個 `DRAFT` 版本。
- 歷史版本保存封存前 head 的 exact `CaseDocument`，包含當時案件欄位、輸入、計算、採用結果、override、report snapshot、record UUID、revision 與 optimistic version。
- 歷史版本不得以目前案件資料補值、重新計算或更新；讀取身分由歷史資料來源決定，不改寫原 snapshot lifecycle。
- 版本以 `caseGroupId + revisionNo` 唯一識別，同案清單依 `revisionNo desc` 排列。

### 3.2 History navigation

- `/cases` 仍維持一個案件一列，只顯示目前版本。
- 案件列以版本文字或單一「歷史版本」連結提供入口，不新增重複 action 欄；`/cases/:id` 工作台 header 只增加一個次要入口。
- `/cases/:id/history` 顯示目前版與歷史版清單，清楚標示「目前版本」與「歷史版本」。
- `/cases/:id/history/:revisionNo` 顯示指定歷史版本的唯讀資料，並提供返回版本清單與目前案件的入口。
- `/cases/:id/history/:revisionNo/report` 只讀取指定歷史版本的 report snapshot，禁止導回目前案件報告 service。
- 目前版清單列導回 `/cases/:id`；只有 archive 列進入唯讀 detail。revision query 找到超過一筆時顯示資料完整性錯誤，不得任選一筆。
- Dynamic routes 必須支援貼上網址直接開啟及重新整理。

### 3.3 Regenerated historical PDF

- 只有含既有 `report_draft.snapshot` 的歷史版本才顯示重新輸出 PDF action。
- 重新輸出使用該歷史 snapshot 與目前報告 renderer／版型；不得讀取目前案件的輸入、計算或 report snapshot。
- 預覽畫面、PDF 本文及檔名必須同時標示「重新產生」，並說明版型可能與當時輸出不同。
- 檔名固定為 `{caseNo}-R{revisionNo兩位數}-REGENERATED.pdf`，不得與一般目前版 PDF 混淆。
- 重新輸出是無狀態操作，不得修改歷史 snapshot、案件 head、版號或 report status。
- 沒有 report snapshot 的歷史版本仍可查看案件與計算資料，但不得臨時建立 report snapshot 或顯示 PDF action。

### 3.4 Permanent deletion

- 「刪除案件」永久刪除目前 head 與全部歷史版本；不提供封存、回收桶或復原。
- 確認介面必須顯示案件識別、版本數量、刪除範圍與不可復原性。
- 只有全部版本均不可再讀取後才顯示刪除成功。
- 刪除過程必須阻止同案同時建立新版；部分失敗時保留可重試狀態，不得留下 UI 宣稱已刪除但 direct URL 仍可讀取的孤立資料。

## 4. Data and Transaction Contract

### 4.1 Storage invariants

- `cases/{caseGroupId}` 繼續代表目前案件 head，維持現有案件清單、搜尋、編號與 optimistic `version` 行為。
- 歷史版本固定保存於 `cases/{caseGroupId}/revisions/{recordId}`；`{recordId}` 必須等於封存前 head 的 `id` UUID。
- archive document 必須與封存前 head 的 `CaseDocument schemaVersion = "3.0"` 逐欄相同；不另包 wrapper、不加入可變 metadata，也不建立第二套 archive schema。
- 歷史 query 只在該案件 subcollection 內依 `revisionNo desc` 排序；現階段不需要 composite index，`firestore.indexes.json` 維持空清單。
- 不得把無上限歷史嵌入單一案件 document，也不得為通過 document size 限制而截斷輸入、計算、override 或報告。因 archive 是已成功保存 head 的 exact clone，不增加 document payload。
- 完整性由 atomic exact-copy 與 archive update 永久拒絕保證；不另存 whole-case hash。report draft 既有 `snapshotHash` 維持原契約。

### 4.2 Create-version transaction

建立新版必須由 `CaseStore.archiveCurrentAndMutate()` 在單一 Firestore transaction 完成；一般 `mutate()` 不得用於 revision increment：

1. 在任何 write 前讀取目前案件與目標 archive，驗證 expected version、`REPORT_DRAFT`、revision 連續性及 `revisions/{oldRecordId}` 尚不存在。
2. 以目前 head 的 `id` 寫入 `revisions/{oldRecordId}`，內容為更新前 head 的 exact `CaseDocument`；既有同 path document 會使 transaction 失敗。
3. 更新案件 head：產生新 UUID、`revisionNo + 1`、`version + 1`、`DRAFT`，並依現行規則清除輸入、計算、assessment、override 與 report draft。
4. Rules 以 `get()`／`getAfter()` 雙向驗證：head 升版必須同時存在等於舊 head 的 archive；archive create 必須同時存在合法下一版 head。

合法下一版必須保留 `caseGroupId`、`caseNo`、案件基本資料、task／mode、建立者及 `createdAt`；只允許新 UUID、連續 revision／version、`updatedAt`、`DRAFT`／null 狀態與被清空的工作資料不同。新 UUID 不得已存在於 revisions。

任一步驟失敗時，archive 與 head 都不得留下部分變更。重複、跳號或 stale request 必須以可理解錯誤拒絕。

### 4.3 Permanent-deletion protocol

- 新增 head lifecycle `DELETING`。`beginDelete(caseGroupId, expectedVersion)` 只能由 active lifecycle 進入，且除 `lifecycleStatus`、`version + 1`、`updatedAt` 外不得改其他欄位。
- `DELETING` 阻止 edit、calculate、report write 與 create revision；`/cases` 顯示「刪除未完成／繼續刪除」。
- `purgeHistory()` 每批最多查詢及刪除 10 個 archives，重複至 query 為空。archive delete 只有 parent 為 `DELETING` 時允許；中斷後從剩餘 documents 續跑。
- `DELETING` 期間 Rules 必須保留 authenticated revision read，讓 deletion repository 可重新查詢剩餘 documents；history UI 先讀 parent，若為 `DELETING` 就只顯示刪除恢復狀態，不得呈現歷史內容。
- query 再次確認為空後，`finishDelete()` 才刪除 head 並重新讀取確認不存在；只有此時 UI 顯示成功。
- Firestore 不會 cascade 刪除 subcollection，Rules 也不能證明 subcollection 已空。本協定以 `DELETING` 阻止新增、由 application 查空後刪 head。共享匿名威脅模型下，惡意 client 提前刪除 deleting head 仍可能留下不可由一般 UI 讀取的 orphan；完全消除此殘餘風險需要可信任 backend，明列為 ADR-012 已接受取捨。

### 4.4 Existing-data compatibility

- 不執行猜測式歷史 migration，也不從目前資料反推先前版本。
- 功能啟用時，既有 `cases` document 直接成為目前 head；只有啟用後建立的新版本會產生 archive。
- 若目前 `revisionNo > 1` 但歷史查詢沒有較早版本，UI 顯示「早期版本未保留」，不得建立空白 placeholder 或偽造資料。
- 目前案例已被覆寫的版本 1，除非另有外部備份，否則不在本 DEV 的恢復範圍。

## 5. Authentication and Rules

- 延續 ADR-009：Anonymous Auth ready 前不 render 案件內容；未登入不能讀寫目前案件或歷史版本。
- 已登入匿名使用者沿用共享讀取模型，可讀目前案件及其歷史版本。
- 歷史 record 只允許符合建版 transaction 的 create；一般 update 一律拒絕。
- 一般 head update 必須保持 `id` 與 `revisionNo` 不變；revision increment 只能走 archive transaction。
- 歷史 delete 只允許 parent 為 `DELETING` 的整案永久刪除流程。
- history read 必須要求 parent 存在；parent 為 `DELETING` 時仍允許 deletion repository 查詢剩餘 archives，但 history UI 不得呈現其內容。parent 不存在的 orphan 不可由一般 client 讀取。
- 未宣告 collection 仍一律拒絕；不得為歷史功能加入廣域 `allow read, write`。
- Rules 必須驗證版本唯一性、case group 關聯、revision 連續性、欄位白名單、型別、大小及必要的跨 document transaction 關係。

## 6. UI Entry and Visible States

Target actor：已完成 Anonymous Auth 的共享使用者。

| State                       | Required behavior                                               |
| --------------------------- | --------------------------------------------------------------- |
| Loading                     | 保留頁面結構並顯示版本資料載入中，不先顯示空狀態                |
| No archived versions        | 顯示「尚無歷史版本」及返回目前案件入口                          |
| Missing early versions      | 顯示「早期版本未保留」，列出實際存在的版本                      |
| Normal                      | 新到舊列出版本，區分目前／歷史並可開啟歷史版                    |
| Historical detail           | 所有資料唯讀；不顯示編輯、計算、儲存或建立新版本操作            |
| Deleting                    | 不讀取或呈現歷史內容；只保留一個「繼續刪除」恢復動作            |
| No report snapshot          | 不顯示重新輸出 PDF action                                       |
| Not found                   | 說明指定版本不存在，提供返回版本清單／目前案件入口              |
| Permission or network error | 顯示可理解原因與適用的重試 action，不誤判為空清單               |
| Narrow viewport             | 390px 不使用 page-level horizontal scroll，狀態與版本號仍可辨識 |

## 7. Failure and Recovery

- Archive／head transaction 失敗：目前版本與版號維持原狀，允許安全重試。
- 歷史列表失敗：不阻擋目前案件，但錯誤狀態不可顯示成「沒有歷史」。
- PDF 重新產生失敗：不修改任何資料，沿用可理解錯誤與重試流程。
- 整案刪除失敗：head 保持 `DELETING`，不得先從 UI 移除案件或顯示成功；再次操作須從剩餘 archive 繼續清理。
- 多 session 同時建版或刪除時，只有一個符合 expected version／deletion guard 的操作可成功。

## 8. Acceptance and Evidence

| Acceptance layer   | Required evidence                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Domain／unit       | 排序、目前／歷史判斷、缺號訊息、exact snapshot decode、重新產生標示與檔名                |
| Firestore Emulator | 原子建版、stale／重複／跳號、未登入拒絕、歷史 update 拒絕、整案刪除、部分失敗重試        |
| UI E2E             | 從 `/cases` 進入歷史、開啟舊版、direct URL reload、建立三版、歷史 PDF 重新輸出、整案刪除 |
| Fail-seeking       | 封存寫入失敗不得增加版號；刪除中另一 session 建版不得留下孤立歷史                        |
| Visual QC          | 1440／1024／390 的入口、loading／empty／missing／error、唯讀頁與重新輸出標示             |
| Static quality     | typecheck、targeted lint、unit、build、`git diff --check`；不得取代 DB 或 UI 證據        |

## 9. Out of Scope

- 還原無外部備份的既有遺失版本。
- 保存或下載當時原始 PDF；重新輸出只代表使用歷史資料套用目前版型。
- 版本差異比較、紅線、變更原因、還原、分支、複製成新案件。
- 匯入外部 PDF／備份重建歷史。
- 新增帳號、角色、核發、可信任 backend、Storage 或 Blaze。
- Production migration、deploy、rollback 或 release artifacts。

## 10. Stop Conditions

- Spark client-only 架構無法同時保證 archive 不可變與建版一致性。
- 完整歷史 record 可能超過 Firestore document size，且只能靠截斷資料才能保存。
- 整案刪除無法阻止同時建版或無法提供可重試的完整清理。
- 歷史 PDF 無法在預覽、本文與檔名清楚揭露「重新產生」。

命中任一條件時停止進入產品實作，回到 RD 架構收斂；不得降低驗收標準後繼續。

## 11. Execution Boundary

目前已達 `RD Implementation Ready`，且架構已定案。產品實作已依 ADR-012 的 slice 完成並發布；本輪沒有 production migration 或正式案件資料寫入／刪除。

## 12. Spec Impact

分類：`Intentional replacement`。

本規格定義 DEV-029 已落地的歷史版本行為，取代 SPEC-001 中「建立新版本只更新單一案件 aggregate 並清除舊資料」的舊契約；ADR-012 是資料與交易架構權威；ADR-009 的 Firebase Spark、Anonymous Auth、共享資料及 client-only 邊界維持不變。`2e1d261` 已部署正式 Rules／Hosting；production static smoke、Auth／Firestore read-only smoke 與一次性授權 production archive history detail／report regeneration／delete smoke 通過，且清理後 current／history direct URL 均拒絕讀取。後續仍須遵守不得未經授權寫入正式資料的邊界。

ADR 判定：已新增 ADR-012，鎖定 current head + immutable revision subcollection、atomic archive、可重試刪除及歷史報告 provenance。若實作發現必須導入 backend／Blaze，停止並另開 ADR，不得在本規格內靜默擴張。
