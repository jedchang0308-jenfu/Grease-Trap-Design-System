# QA-002｜案件歷史版本架構驗證計畫

文件狀態：`Local Verified / Production Feature Smoke Passed / Disposable Fixture Cleaned`

架構定案：`已定案`

版本：`1.2`

日期：`2026-09-21`

關聯任務：`DEV-029`

## 1. Verification Objective

驗證 ADR-012 的 current head + immutable revision subcollection 架構：建版原子性、歷史唯讀、缺號相容、歷史 PDF 重新產生揭露、`DELETING` 可重試刪除與三 viewport UI delivery path。DEV-029 已完成本機自動化驗證。

## 2. Risk and FMEA

| 失效模式                       | 可能原因                                       | 使用者影響                       | 偵測方式                                    | 優先級 | 對策／建議測試                                           |
| ------------------------------ | ---------------------------------------------- | -------------------------------- | ------------------------------------------- | ------ | -------------------------------------------------------- |
| head 已升版但 archive 未建立   | 建版拆成兩次 write 或 Rules 未雙向綁定         | 舊版永久遺失                     | Emulator 檢查 head／archive 同時存在        | P0     | 單一 transaction、`getAfter`、寫入失敗 fail-seeking      |
| archive 可被 update            | Rules 誤開一般 update                          | 歷史內容失真                     | 第二 session 對 archive update              | P0     | 永久 deny update，驗證所有 lifecycle 與 payload 變形     |
| duplicate／reused archive path | 新版 UUID 未更新或 create 退化為 overwrite     | 版本衝突或覆蓋                   | 重複建版與既有 path 負向測試                | P0     | `{recordId}=oldHead.id`、每版新 UUID、create-only Rules  |
| 刪 head 後殘留可讀 archive     | 未清空 subcollection 或 parent read guard 遺漏 | 使用者以為刪除但 direct URL 可讀 | 刪除後 list/get 與 direct URL negative test | P0     | `DELETING` purge、查空、刪 head、parent-exists read rule |
| 刪除中仍可建版                 | lifecycle guard 未覆蓋所有 mutation            | 新 archive 成為孤兒              | 建版／刪除 concurrent integration           | P0     | expected version + lifecycle guard                       |
| 刪除中斷無法續跑               | `DELETING` 時 Rules 禁止查詢剩餘 archives      | 案件永久卡死                     | 第一批後中斷、reload、再次 purge            | P0     | parent 存在即允許 authenticated read；UI 仍禁止顯示內容  |
| 歷史頁混入目前資料             | 共用可寫 service 或 fallback 到 current head   | 舊版內容被污染                   | current／archive 使用明顯不同 fixture       | P0     | history-only service、snapshot assertion                 |
| 重新產生 PDF 被誤認原始檔      | provenance 標示缺漏                            | 文件溯源錯誤                     | 預覽／本文／檔名三處 assertion              | P1     | HTML unit + print E2E                                    |
| 啟用前缺號被偽造               | 依 revisionNo 自動建立 placeholder             | 使用者誤以為資料完整             | revision 3 only fixture                     | P1     | gap presenter unit；固定顯示「早期版本未保留」           |
| loading/error 被畫成 empty     | 非同步狀態合併                                 | 使用者誤判無歷史                 | component／E2E state assertions             | P1     | 狀態互斥，錯誤保留重試 action                            |
| history query 需要漏列 index   | 查詢條件超出單欄排序設計                       | production route 失敗            | Emulator query + index error assertion      | P1     | 只用 subcollection 的 `revisionNo` 單欄排序              |
| 390px action overflow          | 入口重複或 action 固定寬度                     | 歷史入口或返回路徑不可用         | viewport screenshot + overflow assertion    | P2     | 單一入口、窄版堆疊、`scrollWidth` gate                   |

## 3. Required Fixtures

- `CASE-V1-REPORT`：版本 1、`REPORT_DRAFT`、有 report snapshot。
- `CASE-V2-CURRENT`：由 V1 正常建立的目前版本 2，輸入值與 V1 明顯不同。
- `CASE-V3-MISSING-EARLY`：目前 revision 3、只有 revision 2 archive，用於「早期版本未保留」。
- `CASE-NO-REPORT`：archive 無 report draft，用於 action absence。
- `CASE-DELETING-PARTIAL`：head 為 `DELETING`、仍有至少 12 個 archives，用於跨兩個 batch 的 retry。
- 兩個 authenticated anonymous contexts 與一個 unauthenticated context。

常駐 fixtures 只建立在 Auth／Firestore Emulator；不得未經授權使用 production project 或既有正式案件。若 release gate 取得明確的一次性 production fixture 授權，必須使用可辨識資料、透過產品既有 UI／刪除流程操作，並在驗證後確認 head、archives 與 direct routes 均已清除。

## 4. Unit Verification

新增 `tests/unit/case-history.test.ts`：

1. `revisionNo desc` 排序及目前／歷史 label。
2. revision 3 只有 archive 2 時，回傳「早期版本未保留」，不產生版本 1 placeholder。
3. archive exact CaseDocument encode/decode 不遺失 JSON payload 或 lifecycle。
4. `DELETING` 呈現為「刪除未完成／繼續刪除」，不提供工作台 edit action。
5. 沒有 report draft 的 archive 不產生報告 action。
6. 歷史報告檔名為 `{caseNo}-RNN-REGENERATED.pdf`。

更新 `tests/unit/report-html.test.ts`：

- `REGENERATED_HISTORY` 在預覽 metadata 與報告本文出現固定警語。
- 歷史 snapshot 值與目前 head 不同時，HTML 只出現歷史值。
- 一般目前版草稿／正式報告不得誤出現重新產生警語。

## 5. Firestore Rules and Repository Integration

擴充 `tests/integration/firestore-rules-and-repository.test.ts`，必要案例：

1. 未登入 context 不能 list/get/create/update/delete revisions。
2. `archiveCurrentAndMutate` 成功時 exact archive 與新 head 同時存在。
3. stale expected version、舊版非 `REPORT_DRAFT`、archive path 已存在、revision 跳號時兩邊皆不變。
4. 只更新 head 而未 create archive 會被 Rules 拒絕。
5. 只 create archive 而未合法更新 head 會被 Rules 拒絕。
6. archive payload 與舊 head 任一欄不同會被拒絕。
7. archive update 永遠被拒絕；一般 head update 不得改 `id` 或 `revisionNo`。
8. Session A 建版與 Session B begin delete 競爭時，只能有一個符合 expected version 的結果；不留下缺號或孤立可讀 archive。
9. active head 不能直接 delete；必須先進入 `DELETING`。
10. `DELETING` 不得 edit、calculate、export report 或 create revision。
11. 12 個 archives 分兩批 purge；第一批後模擬中斷，再呼叫同一 delete service 可完成。
12. parent 為 `DELETING` 時，authenticated deletion repository 仍可 list/get archives 並續刪；一般 history service 必須先檢查 parent state，且不得回傳歷史內容給 UI。
13. head 存在且非 `DELETING` 時 archive delete 被拒絕；parent 不存在時 archive read 被拒絕。
14. 完成刪除後 head、history list 與歷史 direct get 都不可讀。

Rule 測試需包含一次大於 10 個 archives 的 fixture，以證明小批次協定沒有跨 batch 漏刪；不得依賴 Rules disabled 完成被驗收的產品操作。

## 6. UI E2E and Visual QC

新增 `tests/e2e/case-version-history.spec.ts` 或在既有 full workflow 建立獨立 describe：

1. 從 `/cases` 的版本資訊進入 `/cases/:id/history`。
2. 版本 1 建立版本 2，再建立版本 3；清單順序為目前 3、歷史 2、歷史 1。
3. 歷史 detail direct URL reload 成功，只有唯讀內容及返回入口。
4. 修改目前版後，歷史版仍顯示封存值。
5. 有 snapshot 的版本進入 `/history/:revisionNo/report`；預覽、列印內容與建議檔名皆有 `重新產生`。
6. 無 snapshot 的版本沒有報告 action。
7. revision 3 缺 version 1 archive 時顯示「早期版本未保留」。
8. 刪除確認顯示版本總數與不可復原；模擬 purge 失敗後保留「繼續刪除」，重試後 current/history direct URL 都失效。
9. `DELETING` 案件的 history direct URL 不呈現 archive 內容，只提供返回及「繼續刪除」。
10. loading、empty、missing、permission/network error 不互相混用。
11. 1440×900、1024×768、390×844 均滿足 `scrollWidth <= clientWidth + 1`，無重疊、截斷或 page-level horizontal scroll。
12. 主要流程完成後無非預期 `.inline-error`、`[role="alert"]`、console error 或 `pageerror`；版本數、排序及目前／歷史標示不得意外為空或重複。

每個主要 state 保存 full-page screenshot 到 OS temp evidence；不提交 binary artifacts。

## 7. Gate Commands

```powershell
npx vitest run tests/unit/case-version-history.test.ts tests/unit/report-html.test.ts
npm run test:integration
npx playwright test tests/e2e/case-version-history.spec.ts
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
```

`test:integration` 與 Playwright evidence 使用 task-owned emulator/runtime；完成後依 AGENTS.md 停止該 process tree 並確認 port 釋放。

## 8. QC Evidence Record

實作完成時須新增或更新 QC 文件，逐項記錄：

- command、exit code、執行日期、fixture/project、實際結果。
- Rules negative tests 的拒絕證據與 concurrent fail-seeking 結果。
- `DELETING` 期間 raw authenticated context 可查詢待刪 archives、history UI 不呈現內容，以及 parent 刪除後 read 被拒絕的三段證據。
- 三 viewport screenshot 路徑、console error、pageerror、overflow 數值。
- 刪除中斷／重試的可見狀態與最後 current/history 不可讀證據。
- PDF 三處 `重新產生` 標示及歷史資料未混入目前 head 的證據。

不得用 build、typecheck 或單張正常畫面取代 transaction、Rules、錯誤路徑與 UI delivery-path evidence。

## 9. Stop Conditions

- archive 與 head 不能在同一 Firestore transaction 內完成並受 Rules 雙向約束。
- exact CaseDocument archive 因既有可保存資料而超過 document limit；不得改成靜默截斷。
- `DELETING` 狀態仍可由正常 repository 建版或寫報告。
- `DELETING` 期間 deletion repository 無法重新查詢剩餘 archives，或一般 history UI 仍會呈現其內容。
- purge 中斷後無法安全重試，或 UI 在 head 實際刪除前顯示成功。
- 歷史 PDF 任一出口未標示 `重新產生`，或讀到目前 head 資料。
- 實作需要 Cloud Functions、Admin SDK、Storage、Blaze 或 production migration；先回 ADR review，不得自行擴張。

## 10. Current Evidence Status

`Local Verified / Production Published / Production Feature Smoke Passed / Disposable Fixture Cleaned`。

已通過（2026-09-21，`demo-grease-trap` Firestore Emulator）：

- `npm test`：51 tests passed（含 `tests/unit/case-history.test.ts` 與 `tests/unit/report-html.test.ts`）。
- `npx vitest run tests/integration`：7 tests passed；覆蓋匿名共享、atomic archive/head、archive update deny、`DELETING` read／purge／finish delete。
- `npm run format:check`、`npm run lint`、`npm run typecheck`、`npm run build`：均 exit code 0。
- `git diff --check`：需在交付前再執行並記錄結果。

未完成／未宣稱：

- `npm run test:integration`／`npm run test:e2e` 的標準 supervisor 會受既有 8080／9099 emulator 佔用與 Firebase CLI configstore 權限影響；未停止非本任務 runtime，也未將既有瀏覽器頁面當作測試環境。
- 改用 task-owned 8180／9199 emulator、3210 Vite 與暫存 Playwright config：`full-workflow.spec.ts` 的 desktop-1440、tablet-1024、mobile-390 各 1 passed；流程包含版本 2 建立、歷史清單／唯讀明細／歷史報告重新產生預覽，並通過 overflow／console error／pageerror assertions。測試後所有 task-owned ports 已釋放，暫存設定已移除。

已發布（2026-09-22，commit `2e1d261`）：

- `firestore.rules` 編譯成功並發布至 `jenfu-grease-trap-calculator`。
- `dist/` 發布至 `https://jenfu-grease-trap-calculator.web.app`；canonical root、SPA deep route 與 production asset hash 均與本地 build 對應。

已通過（2026-09-22，production read-only browser smoke）：

- 使用 task-owned Playwright CLI 以 `domcontentloaded` 加明確 DOM readiness 驗證 production Auth／Firestore；`/cases` 成功載入 9 筆既有案件。
- 逐一讀取 9 筆既有案件的 `/history` route，均成功載入並正確呈現 `尚無歷史版本`；未將 empty state 與 loading／error 混用。
- 讀取目前 production 案件 report route，成功載入 `報告草稿預覽`、報告 iframe、`1 案件資料`、`3 本次設計結果`、`4 完整計算過程` 與目前結果；console errors／warnings 為 0。
- 驗證期間未建立、修改或刪除 production 案件；task-owned browser session 已關閉。

已通過（2026-09-22，使用者明確授權的一次性 production fixture）：

- 以 UI 建立可辨識案件 `HISTORY-FLOW-SMOKE-ONE-TIME`（`GTC-260922-01`），完成必要輸入與計算，保存 REPORT_DRAFT。
- 建立版本 2 後，版本清單正確呈現目前版本 2 與歷史版本 1；歷史版本 1 可開啟唯讀明細，保存的案件資料與計算結果未混入目前版本。
- 歷史報告重新產生預覽通過精簡與完整兩種設定，均出現「歷史版本重新產生」與「不是當時的原始 PDF」警語，且完整模式保留參考資訊分隔線。
- 透過案件清單既有刪除流程刪除整案；刪除後目前案件 direct URL 與 `/history` direct URL 均顯示 `找不到這筆共享案件`，確認 current head 與 revision archive 均已清除。
- 此次 production fixture 未留下正式資料。驗證工作階段記錄兩筆長時間 Firestore Listen `ERR_QUIC_PROTOCOL_ERROR.QUIC_NETWORK_IDLE_TIMEOUT`；發生於功能完成後的 idle reconnect，未造成頁面錯誤、資料錯誤或操作失敗。
