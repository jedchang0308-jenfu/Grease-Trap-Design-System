# QA-001｜第一階段驗證計畫

文件狀態：`QA Ready`  
版本：`1.2`
日期：`2026-07-14`
對應：SPEC-001、SPEC-002、ADR-001～006、DEV-001～013

## 1. 驗證目標

證明系統不是只會顯示結果，而是能在正確的公式、單位、規則版本、軌別隔離、狀態、權限與報告快照下重現結果。

第一階段 release 前必須證明：

- 兩軌五任務覆蓋完整。
- 官方案例與來源錯字已正確處理。
- 一軌成功可覆核／核發，零軌成功才阻擋。
- 未完成軌不產生假結果。
- 同一位已登入使用者可完成編製、覆核與核發，三個責任事件分別可追溯。
- 系統不包含產品型號或證書匹配資料、API、UI 或報告結論。
- UI 在主要 viewport 下能操作且沒有可見 runtime error。
- PDF 由快照產生，規則更新不改變舊報告。

## 2. 風險矩陣

| 風險 | 嚴重度 | 主要控制 | 必要證據 |
|---|---|---|---|
| 新舊公式或單位混用 | Critical | domain 型別＋隔離 calculator | unit／integration |
| PDF 錯字被當真值 | Critical | source discrepancy＋重算 fixture | exact regression |
| 有效軌被不足軌阻擋 | High | ADR-002 狀態矩陣 | API＋E2E |
| 未完成軌出現假數值 | Critical | TrackAssessment／run constraint | DB＋API＋UI |
| 產品／證書匹配被誤重新加入 | High | ADR-004 scope guard | schema／API／UI absence tests |
| 單人流程被 separation-of-duty 阻擋 | High | ADR-005 actor rule | API＋E2E＋audit |
| raw 值被提前截斷 | High | decimal＋raw/adopted 分層 | precision tests |
| n0 越界或跨空白內插 | Critical | segment resolver＋exception | boundary tests |
| 報告受 live data 污染 | Critical | immutable snapshot | snapshot regression |
| 權限繞過 | Critical | server-side authorization | API negative tests |
| UI 提醒被理解為阻擋 | High | Now What 文案＋可用 CTA | E2E＋manual UX |
| 選填基本資料仍阻擋建案，或餐飲類型在錯誤步驟被預先代選 | High | 建案 schema default＋工作台 required select | contract unit＋E2E＋manual UX |

## 3. 測試分層

| 層 | 範圍 | 何時執行 |
|---|---|---|
| Unit | pure calculators、units、interpolation、rounding、solver | 每次 domain 變更 |
| Integration | repository、transaction、orchestrator、API、permissions | 每個 DEV slice |
| Contract | request／response schema、error code、snapshot schema | API／報告變更 |
| E2E | 建案、計算、提醒、覆核、核發、修訂 | Phase 3 後 |
| PDF | 內容、分頁、字型、hash、來源與限制 | DEV-009 後 |
| UI QC | viewport、互動、visible errors、accessibility | DEV-007 後持續執行 |
| Manual engineering QC | 官方案例逐步重算、來源頁核對 | Phase 4 |

## 4. 現行官方回歸案例

所有公式以 Decimal 重算；source display 只作比對，正式限制比較與反推使用 raw。

| ID | 輸入摘要 | raw Q L/min | raw G kg | source display | adopted 向上 0.1 |
|---|---|---:|---:|---|---|
| CUR-AREA-001 | 中餐，A=610，n0=3.4 來源例外，iu=ib=7 | 566.891339869281… | 163.264705882352… | 566.8／163.2 | 566.9／163.3 |
| CUR-DIN-001 | 中餐，N=1000，iu=ib=7 | 388.888888888888… | 112.000 | 388.8／112.0 | 388.9／112.0 |
| CUR-SCHOOL-001 | 學校午餐，N=2150，iu=ib=7 | 235.15625 | 15.0500 | 235.1／15.0 | 235.2／15.1 |
| CUR-MIX-AREA-001 | 複合餐廳採中餐，A=385，iu=ib=7 | 357.792075163398… | 103.044117647058… | 357.7／103.0 | 357.8／103.1 |
| CUR-MIX-DIN-001 | 複合餐廳採中餐，N=600，iu=ib=7 | 233.333333333333… | 67.200 | 233.3／67.2 | 233.4／67.2 |

CUR-AREA-001 必須同時驗證 `SOURCE_EXCEPTION` 警示；610 以外的中餐表外值不得因這個 fixture 自動放行。

## 5. 舊版來源回歸案例

| ID | 輸入摘要 | 預期 raw Q L/h | 預期 raw V L | 錯字防回歸 |
|---|---|---:|---:|---|
| LEG-MEAL-001 | 午餐 50×50/4、晚餐 80×50/5，餐期平均，k=1.5 | 1068.75 | 178.125 | adopted V=178.2，不抄來源 178.1 |
| LEG-SCHOOL-001 | 500 人×3 餐=1500，q=100，t=10，k=1.3 | 19500 | 3250 | 不接受摘錄漏零中間式 |
| LEG-MEASURED-001 | 實測 2000 L／4 h，k=1.2 | 600 | 100 | measured route 正確 |
| LEG-AREA-001 | 200 m²×0.5×8=800，q=30，t=12，k=1.5 | 3000 | 500 | 不接受 `300` 錯字 |

## 6. 五任務 × 雙軌必要路徑

至少 10 組獨立正向路徑：

| 任務 | 現行軌 | 舊版軌 |
|---|---|---|
| T01 | L/min、來源與參數 trace | L/h、legacy k 與 q trace |
| T02 | Q/G 設計需求 | Q＋Veff |
| T03 | kitchen＋dining 全面積 | area→n→Q |
| T04 | Q/G 設計需求 | Q＋Veff＋effective volume 語意 |
| T05 | 輸入 Q/G 能力、控制條件與等效上限 | Veff 反推人數與面積 |

每條正向路徑至少搭配一個必要欄位缺漏反例與一個單位錯誤反例。

## 7. A-36 與 solver 邊界

必測：

- 每個 exact numeric point。
- 每個相鄰 numeric point 的中間值線性內插。
- 不得跨 `-`／blank 內插。
- 範圍下緣、上緣、剛低於、剛高於。
- 中餐 A=610 精確例外；A=609.9、610.1 不套用例外。
- 反推結果向下 0.1 後仍同時符合 `Q(A)<Qcapacity`、`G(A)<Gcapacity`。
- Q 控制、G 控制、兩者同時臨界。
- solver 無合法區段時回 INVALID，不進入無限迴圈或 NaN。

## 8. 精度與 property tests

- 同一 input＋RuleSet 永遠得到相同 raw result 與 input hash。
- 正輸入不產生負值、Infinity、NaN。
- 單一有效區段內增加 N 不得降低人數法 Q/G。
- 同一參數正向後反推的 adopted maximum 不得高於原始 N／A 容許精度。
- L/h ↔ L/min 顯式轉換可逆，trace 有轉換步驟。
- 任何顯示格式變更不能改變 raw result 或反推限制判定。
- 正向 adopted requirement 不小於 raw；反向 adopted maximum 不大於 raw。

## 9. 雙軌放行矩陣

| ID | Current | Legacy | 預期狀態 | releaseEligible | 預期 run 數 |
|---|---|---|---|---:|---:|
| DUAL-001 | CALCULATED | CALCULATED | COMPLETE | true | 2 |
| DUAL-002 | CALCULATED | INSUFFICIENT_DATA | COMPLETE_WITH_REMINDER | true | 1 |
| DUAL-003 | INSUFFICIENT_DATA | CALCULATED | COMPLETE_WITH_REMINDER | true | 1 |
| DUAL-004 | CALCULATED | ERROR | COMPLETE_WITH_REMINDER | true | 1 |
| DUAL-005 | INVALID | CALCULATED | COMPLETE_WITH_REMINDER | true | 1 |
| DUAL-006 | INSUFFICIENT_DATA | INVALID | BLOCKED | false | 0 |
| DUAL-007 | ERROR | ERROR | BLOCKED | false | 0 |

資料庫、API、UI 與 PDF 都必須驗證：未完成軌沒有 `CalculationRun`、沒有 result value、只有 assessment 與原因。

## 10. 設計能力輸入與 Scope Guard

- T05 缺 Qcapacity、Gcapacity、單位或來源時，現行軌回 `INSUFFICIENT_DATA`。
- Qcapacity／Gcapacity 等於需求 raw 值時，依嚴格 `<` 限制不得計入可承載上限。
- 畫面 adopted 值不同於 raw 時，反推仍依 raw 限制判定。
- schema 不存在 product model、certificate 或 match aggregate。
- API 不存在產品或證書管理 route，response 不存在 match status。
- UI 與 PDF 不顯示已匹配型號或證書結論；報告限制章節揭露未執行符合性判定。

## 11. API、資料與交易

- request schema 缺 caseId、taskCode、mode、idempotencyKey 時 400 problem+json。
- 雙軌缺其中一軌 inputs 回完整 assessment，不使用 400 隱藏業務缺口。
- 相同 idempotency key＋相同 payload 回同一結果；不同 payload 回 409。
- stale expectedCaseVersion 回 409，不覆寫新資料。
- per-track savepoint：一軌 throw 時另一軌 run 可提交。
- parent commit failure：assessment 與 run 全部 rollback。
- active RuleSet immutable；啟用失敗不留半啟用狀態。
- issued snapshot update／delete 被 DB／service 阻擋。
- API 未授權、角色不足、跨案件 access 均有 negative test。

## 12. 案件生命週期與修訂

必測合法轉換、非法跳轉、退回、重送、重算、核發與 supersede：

- BLOCKED 不得提交覆核。
- COMPLETE／COMPLETE_WITH_REMINDER 可提交。
- 未 REVIEWED 不得 issue。
- ISSUED 不可編輯；修改必須建立 revision+1。
- 新 revision 核發後前版 SUPERSEDED，但舊 PDF 可下載且內容不變。
- override 未核准不得進入正式 snapshot。
- preparedBy、reviewedBy、issuedBy 可以是同一 actor；API 不得以相同 actor 為由阻擋。
- 同一 actor 的提交、覆核與核發必須形成三筆可區分的 audit event。

## 13. PDF 驗證

三種樣本：現行、舊版、雙軌；雙軌另含單軌完成樣本。

檢查：

- 封面、報告版本、案件、狀態與 report number policy。
- 方法、來源、單位、公式、raw/adopted、限制與簽核。
- 舊版歷史方法標籤。
- COMPLETE_WITH_REMINDER 顯示「雙軌案件—單軌完成」。
- 未完成軌顯示「未計算」與原因，無空白假值。
- 報告限制章節明示未執行產品或證書符合性判定，且全文不列相符型號結論。
- PDF 只讀 snapshot；修改 live rule 後重新 render 內容不變。
- 以 Poppler render 全頁，檢查字型、黑方塊、裁切、重疊、表格與頁碼。

## 14. UI／UX QC

critical routes：`/cases`、`/cases/new`、案件工作台、review、report、rules。

必測 viewport：`1440×900`、`1024×768`、`390×844`。

### Visible Error Sweep

每個 route 記錄 URL、viewport、時間、fixture、截圖、`.inline-error`／`[role=alert]`、visible HTTP／API error、console／network failure 與判定。

### Now What 驗證

逐項驗證 SPEC-002 的 loading、empty、validation error、BLOCKED、COMPLETE、COMPLETE_WITH_REMINDER、IN_REVIEW、returned、REVIEWED、ISSUED、SUPERSEDED、no permission、runtime error。

### Manual UX review

- `/cases/new` 的基本資料可全部留白建案，餐飲類型不出現在該頁；案件工作台的現行 Q/G 計算資料才顯示餐飲類型，且未選時不可送出計算。
- 空白案件名稱以案件編號識別，空白客戶與地點有「未填」替代文字。
- 5 秒內知道頁面用途、狀態與下一步。
- COMPLETE_WITH_REMINDER 第一行先說「可繼續覆核」。
- IN_REVIEW 明示目前使用者可繼續，不要求切換帳號或等待他人。
- primary CTA 唯一且可用。
- blocked／disabled 提供替代下一步。
- 首屏沒有長篇公式／制度教學。
- keyboard、focus、label、error、modal／drawer 可操作。
- 無重疊、裁切、斷裂、非預期 overflow 或 scroll chaining。

## 15. Phase Gates

| Gate | 對應 DEV | 通過條件 |
|---|---|---|
| G1 Foundation | 001～002 | 固定啟動入口、schema、migration、全部 factor seed checksum 與 source fixtures 通過 |
| G2 Calculation | 003～005 | 現行／舊版官方案例、reverse、precision、dual matrix 全通過 |
| G3 Workflow | 007～009 | case、single-user review／issue、snapshot、PDF integration／E2E 通過；DEV-006 依 ADR-004 跳過 |
| G4 Acceptance | 010～011 | 完整 regression、UI QC、manual engineering QC 通過 |

上一 gate 未通過不得把下一 phase 宣告完成；可在不掩蓋 blocker 的前提下平行開發獨立工作。

## 16. Evidence Required

- 測試命令、commit／worktree 狀態與完整 exit code。
- 自動測試 report、coverage 摘要、fixture 與 input/output snapshot。
- RuleSet／source hash、seed checksum、migration 版本。
- API contract 與 DB constraint 測試結果。
- 身份、session、匿名、角色不足、跨案件與單一 actor 全流程測試結果。
- 每個 critical UI route／viewport 截圖與 visible error sweep。
- 現行、舊版、雙軌、單軌完成 PDF 樣本與 render PNG。
- QC 人工逐步重算紀錄及 Pass／Fail／未充分驗證判定。

## 17. QA Stop Conditions

- 預期值只能靠抄來源顯示值而無法重算。
- 測試使用與 production code 相同公式重新計算 expected value，造成假陽性。
- 一軌失敗導致另一軌 result 消失或案件 BLOCKED。
- UI 顯示 runtime error、API route 或不可復原狀態。
- PDF 直接讀 live tables 或輸出時重算。
- snapshot、run、source checksum 無法重現。
- 相同 actor 被阻擋而無法完成覆核／核發，或三個責任事件被合併成一筆 audit。
- 任何產品型號或證書匹配功能在未重新決策下出現在 schema、API、UI 或 PDF。
- 關鍵 viewport 缺實際瀏覽器證據。

## 18. 最終通過標準

所有 Critical／High 風險案例通過；G1～G4 通過；無未處理 P0／P1 defect；必要 evidence 完整。Production release 仍需另進 release gate，QA 完成不等於已上線。
