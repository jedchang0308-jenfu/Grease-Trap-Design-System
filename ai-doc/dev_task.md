# Dev Task｜油脂截留器雙軌計算系統

文件狀態：`Firebase Local Engineering Complete — Human Pilot Pending`
版本：`2.7`
最後更新：`2026-07-17`
本輪執行邊界：DEV-018 本地 RD／自動化 QA／QC 已完成；未建立正式 Firebase project、未部署、未搬移舊 PostgreSQL 資料
產品完成基準：9 個有效交付點，目前完成 9／9（100%）；DEV-006 已由使用者決策跳過，不計入分母

## 總任務清單

- ✓ DEV-001 [交付點] [完成] [P0] 建立本地可啟動的專案骨架
  - 摘要：建立固定啟動入口、模組目錄、型別／格式／測試基礎與 persistence boundary，讓後續 DEV 有一致執行環境；DEV-018 已將本機資料層替換為 memory adapter。
  - 來源 ID：`GTC-PH1-FOUNDATION-001`
  - 父任務：無
  - 下一步：無；固定入口為 `npm run dev:local`／`http://localhost:3100`
  - 證據：Node 24、Next.js 16、memory adapter、lockfile、health、lint、typecheck、build、Git boundary
  - 計入交付：是

- ✓ DEV-002 [交付點] [完成] [P0] 建立版本化來源、規則與參數庫
  - 摘要：把內政部給排水規範（附錄 5）的 A-34～A-37、臺北市工務局衛工處設計說明的 Q/V 參數、來源雜湊與 discrepancy 建成可查、不可靜默修改的版本化 catalog；DEV-018 已移除 database seed。
  - 來源 ID：`GTC-PH1-RULES-002`
  - 父任務：無
  - 下一步：只有新法規來源版本出現時建立新 RuleSet，不回寫 ACTIVE 版本
  - 證據：版本控制 catalog、rule checksum、factor counts、unit 與 application integration tests
  - 計入交付：是

- ✓ DEV-003 [交付點] [完成] [P0] 實作內政部給排水規範（附錄 5）Q/G 正向與反向計算核心
  - 摘要：交付人數、全面積、輸入 Q/G 能力反推、A-36 內插與來源例外的高精度純計算核心。
  - 來源 ID：`GTC-PH2-CURRENT-003`
  - 父任務：無
  - 下一步：無
  - 證據：CUR 官方案例、A-36 exception／interpolation、precision、strict reverse unit tests
  - 計入交付：是

- ✓ DEV-004 [交付點] [完成] [P0] 實作臺北市工務局衛工處設計說明 Q/V 正向與反向計算核心
  - 摘要：交付人數、餐期平均、實測、面積與有效容量反推，並防止來源錯字與參數猜值。
  - 來源 ID：`GTC-PH2-LEGACY-004`
  - 父任務：無
  - 下一步：無
  - 證據：LEG 用餐、學校、實測、面積、reverse、exact k 與 unit-of-measure tests
  - 計入交付：是

- ✓ DEV-005 [交付點] [完成] [P0] 實作雙軌 orchestrator 與任一有效軌放行
  - 摘要：隔離執行兩軌，保存 assessment／run，以 COMPLETE、COMPLETE_WITH_REMINDER、BLOCKED 正確控制覆核資格。
  - 來源 ID：`GTC-PH2-DUAL-005`
  - 父任務：無
  - 下一步：無
  - 證據：雙軌矩陣、單軌 commit、無假結果、idempotency、optimistic version、savepoint／constraint tests
  - 計入交付：是

- × DEV-006 [交付點] [跳過] [P1] [使用者取消] 建立產品與證書主檔及匹配
  - 摘要：原規劃建立產品與證書匹配；使用者已明確移除此功能，保留 DEV ID 作決策追溯。
  - 來源 ID：`GTC-PH3-PRODUCT-006`
  - 父任務：無
  - 下一步：不執行；如未來重新提出，依 ADR-004 建立新 DEV，不恢復本 ID
  - 證據：HD-07、ADR-004
  - 計入交付：否

- ✓ DEV-007 [交付點] [完成] [P1] 建立案件清單、任務精靈與計算工作台
  - 摘要：讓工程人員以五個客戶任務建立案件、動態補資料並看懂兩軌結果與下一步。
  - 來源 ID：`GTC-PH3-CASE-UI-007`
  - 父任務：無
  - 下一步：無
  - 證據：完整 E2E、Now What states、匿名安全錯誤、1440／1024／390 screenshots
  - 計入交付：是

- ✓ DEV-008 [交付點] [完成] [P1] 建立工程覆核、退回、override 與 audit
  - 摘要：交付同一使用者可完成且可追溯的提交、覆核、退回、核准與修訂流程，保護已覆核與已核發資料。
  - 來源 ID：`GTC-PH3-REVIEW-008`
  - 父任務：無
  - 下一步：無
  - 證據：同 actor submit／review／issue、state transition、role guard、audit、override／revision contracts
  - 計入交付：是

- ✓ DEV-009 [交付點] [完成] [P1] 建立 ReportSnapshot 與設計計算書 PDF
  - 摘要：從 reviewed revision 建立不可變快照，產生兩份計算依據、對照與單份完成的正式報告版型。
  - 來源 ID：`GTC-PH3-REPORT-009`
  - 父任務：無
  - 下一步：正式報告編號格式於首次 release 前由人類決定
  - 證據：snapshot／issued update immutability、案件刪除級聯、四份 A4 PDF、22 頁 render PNG、content regression
  - 計入交付：是

- ✓ DEV-010 [QA/QC] [完成] [P1] 完成自動化回歸與 UI QC 套件
  - 摘要：將 QA-001 的計算、API、狀態、權限、E2E、PDF 與 viewport 驗證落成可重跑證據。
  - 來源 ID：`GTC-PH4-QA-010`
  - 父任務：DEV-003、DEV-004、DEV-005、DEV-007、DEV-008、DEV-009
  - 下一步：新功能或 bugfix 必須維持同一 regression gate
  - 證據：21 unit、9 integration、12 E2E、production build、screenshots、visible error／overflow sweep
  - 計入交付：否

- ! DEV-011 [關卡] [阻塞] [P1] [待人類實例] 完成本地 RD／QA／QC 驗收
  - 摘要：以真實案件 fixture 完成全流程，確認第一階段產品功能達到本地交付標準。
  - 來源 ID：`GTC-PH4-ACCEPTANCE-011`
  - 父任務：DEV-001～DEV-005、DEV-007～DEV-009
  - 下一步：人類提供 3～5 個去識別實際案件、人工結果與可接受差異後執行 parallel diff
  - 阻塞／恢復條件：真實案件證據不可由 AI 假造；收到去識別資料後恢復
  - 證據：QC-001、兩份來源案例重算、四種 PDF、三 viewport E2E；parallel diff 待補
  - 計入交付：否

- ↷ DEV-012 [關卡] [延後] [P2] [Release Gate Required] 正式環境發版
  - 摘要：雲端內部使用的 End-State 已固定；集中處理未來的 provider、Auth、正式報告編號、部署與 production gate，不預寫 release artifacts。
  - 來源 ID：`GTC-RELEASE-012`
  - 父任務：DEV-011
  - 下一步：等待使用者明確提出部署、上線或 release
  - 恢復條件：DEV-011 通過且使用者提出 release 型指令
  - 計入交付：否

- ✓ DEV-013 [開發點] [完成] [P1] [本地工程完成] 調整建案基本資料與餐飲類型步驟
  - 摘要：基本資料全部改為選填，餐飲類型移至計算資料並要求明確選擇，空白案件仍有可讀識別。
  - 來源 ID：`GTC-PH3-CASE-UI-OPTIONAL-013`
  - 父任務：DEV-007
  - 下一步：無；正式發版仍集中於 DEV-012
  - 證據：21 unit、lint、typecheck、format、production build、12 E2E、1440／1024／390 Playwright QC
  - 計入交付：否

- ✓ DEV-014 [開發點] [完成] [P1] [本地工程] 將完整報告草稿前置到最終工程覆核之前
  - 摘要：編製者先完成可預覽報告與人工採用，審核者最後針對完整送審報告集中審核一次；核准後仍建立不可變快照並核發。
  - 來源 ID：`GTC-PH3-REPORT-FIRST-014`
  - 父任務：DEV-008、DEV-009、DEV-010
  - 下一步：新功能或 bugfix 必須維持同一 regression gate
  - 阻塞／恢復條件：不得讓未覆核草稿進入正式 issue；不得允許 IN_REVIEW 後新增人工採用
  - 證據：草稿預覽 API／UI、最終覆核只讀例外、9 integration、12 三 viewport E2E、21 unit、lint／typecheck／format／build
  - 計入交付：否

- ✓ DEV-015 [開發點] [完成] [P1] [本地工程] 重構客戶報告的輸入、計算依據與輸出
  - 摘要：第一個資訊區塊直接回答輸入什麼、依什麼來源、輸出什麼；完整計算改為具名、具單位、具資料角色的代入表。
  - 來源 ID：`GTC-PH3-REPORT-IO-015`
  - 父任務：DEV-009
  - 下一步：無；後續報告變更須維持相同輸入／輸出與具名代入契約
  - 阻塞／恢復條件：不得從 live data 重算報告；不得以 0、空白或推測值補齊未完成資料
  - 證據：25 unit、lint、typecheck、本次檔案 format／diff check、四種 A4 PDF 共 9 頁 render、指定地端真實案件 browser QC
  - 計入交付：否

- ✓ DEV-016 [開發點] [完成] [P1] [本地工程] 加強輸入條件來源分類與選值溝通
  - 摘要：把計算輸入分成案件資料、工程選值、設備資料、實測資料與覆寫值，工作台與報告共用完整性 badge、結構化選值理由與來源／理由欄。
  - 來源 ID：`GTC-PH3-INPUT-SOURCE-016`
  - 父任務：DEV-007、DEV-009、DEV-015
  - 下一步：多餐期、實測水量與複合式餐飲候選比較另作後續 DEV，不納入本次切片
  - 阻塞／恢復條件：不得把工程經驗欄位誤導為法規指定值；不得因加入說明欄位改變既有計算公式
  - 證據：report presentation/html unit、lint、typecheck、地端工作台與報告預覽 Playwright snapshot
  - 計入交付：否

- ✓ DEV-017 [開發點] [完成] [P2] [本地工程] 統一案件工作台計算提交按鈕位置
  - 摘要：送出計算按鈕固定置於「計算資料」結尾；第一次顯示「開始計算」，有計算紀錄後顯示「重新計算」，且使用與「完成報告草稿」一致的主要按鈕呈現；結果區只保留本次設計結果與後續流程 CTA。
  - 來源 ID：`GTC-UX-WORKFLOW-017`
  - 父任務：DEV-015、DEV-016
  - 下一步：新功能或 bugfix 維持同一計算提交位置與同一 regression gate
  - 阻塞／恢復條件：不得在結果區重複放置重新計算，造成同一動作多入口與文案狀態分歧
  - 證據：typecheck、lint、指定案件 1440／390 viewport snapshot、桌面／窄版 screenshot、document/body width sweep
  - 計入交付：否

- ✓ DEV-018 [交付點] [完成] [P0] [本地工程] 重構為 Firebase 代管式多人協作架構
  - 摘要：保留 server-side 計算核心與 UI／API 契約，將 PostgreSQL、seed identity 與本機 PDF 路徑替換為 Firebase Auth、Firestore、Storage 及 App Hosting-ready 設定。
  - 來源 ID：`GTC-FIREBASE-ARCH-018`
  - 父任務：DEV-001、DEV-005、DEV-007、DEV-009
  - 下一步：正式多人部署時進入 DEV-012，建立 Firebase project 並補 emulator／staging／production smoke
  - 阻塞／恢復條件：正式 Firebase project、credential 與 production deploy 仍屬 DEV-012；本 DEV 不得接觸正式資料或部署
  - 證據：ADR-007、27 unit、8 memory integration、lint、typecheck、format、build、三 viewport 12 E2E；Firebase Emulator 因本機缺 Java 標記 Not Run
  - 計入交付：是

## Phase 執行順序

```text
G1 Foundation: DEV-001 → DEV-002
                     ├→ DEV-003 ─┐
G2 Calculation:      └→ DEV-004 ─┴→ DEV-005
G3 Workflow: DEV-005 → DEV-007 → DEV-008 → DEV-009 → DEV-014 → DEV-015 → DEV-016
G4 Acceptance: DEV-003～005、007～009 → DEV-010 → DEV-011
Architecture: DEV-018（本輪 Firebase 重構）
Release: DEV-012（需另行指令）
```

同時只有一個最高優先、依賴已通過、未阻塞的 DEV 可由 `完成 dev_task` 自動選取。

---

## DEV-001：建立本地可啟動的專案骨架

狀態：完成  
節點類型：交付點  
是否計入產品交付：是

### 目標

在專案根目錄建立可重現的 TypeScript Web 專案、固定本地啟動入口、PostgreSQL 開發連線、測試框架與模組邊界。

### Scope

- 初始化 Git 與 package manager lockfile。
- 建立固定 `dev:local` 啟動命令與環境範本，不提交 secret。
- 建立 SPEC-001 的模組目錄與 ports/adapters 邊界。
- 建立 DB migration runner、unit／integration／E2E 測試入口。
- 建立 provider-neutral AuthPort、seed identity 與 authenticated route guard 骨架，正式 provider 不在本 DEV 選定。
- 建立 lint、format、typecheck、build scripts。
- 建立最小 health route 與空案件清單 shell。

### Out of scope

- 正式 calculator、業務 schema、完整 UI、正式 Auth provider、雲端部署。

### Required docs

- ADR-003、SPEC-001 第 14、21 節、SPEC-002 第 3 節。

### Acceptance

- 新環境依 README 可安裝並以固定命令啟動。
- health、build、typecheck、lint、unit smoke 通過。
- business routes 預設需 authenticated identity；seed user 可在 local 完成 smoke。
- 沒有公式寫在 UI／route。
- `.env.example` 完整且 repository 無 credential。

### Stop conditions

- 需要付費 provider、正式 credential 或 production 連線。
- 選定 framework 會破壞 ADR-003 的 provider-neutral／module boundary。

### Evidence

- 指令與 exit code、local URL、目錄 tree、Git status。

---

## DEV-002：建立版本化來源、規則與參數庫

狀態：完成  
節點類型：交付點  
是否計入產品交付：是

### Scope

- 建立 SourceDocument、SourceDiscrepancy、RuleSet、FactorTable、FactorPoint schema。
- seed SPEC-001 的 A-34～A-37、legacy q／density／turnover／k。
- 明確保存 A-36 VALUE／DASH／BLANK 與 610 m² source exception。
- 建立 immutable active RuleSet、checksum 與 activation service 骨架。
- 建立 local migration、rollback-in-development 與 seed verifier。

### Out of scope

- 規則管理完整 UI、正式規則啟用權限流程。

### Acceptance

- 來源 hash、表格點數與 SPEC-001 完全一致。
- active version 不可 update。
- 錯字 resolution 可查；不把錯字值 seed 成真值。
- G1 tests 通過。

### Stop conditions

- 任一參數無法對應來源頁或 SPEC-001。
- migration 會連到正式／遠端資料庫。

### Evidence

- migration、schema diff、seed checksum、factor fixture tests。

---

## DEV-003：實作內政部給排水規範（附錄 5）Q/G 正向與反向計算核心

狀態：完成  
節點類型：交付點  
是否計入產品交付：是

### Scope

- typed units、decimal、raw/source/adopted values。
- calculateCurrentByDiners、calculateCurrentByArea。
- A-36 interpolation／exception resolver。
- reverseCurrentByCapacity 與 piecewise area solver。
- composite dining candidate comparison。
- calculation trace builder。

### Out of scope

- DB orchestration、產品／證書匹配、UI、PDF。

### Acceptance

- QA-001 CUR 案例、A-36 邊界、precision、property tests 通過。
- 沒有 JavaScript floating comparison 決定正式結果。
- solver 不跨來源空白。

### Stop conditions

- 嘗試以公升數反推現行能力。
- 來源表外值被靜默外插。

### Evidence

- unit／property test report、calculation trace snapshots。

---

## DEV-004：實作臺北市工務局衛工處設計說明 Q/V 正向與反向計算核心

狀態：完成  
節點類型：交付點  
是否計入產品交付：是

### Scope

- legacy single period、source arithmetic mean、measured、area calculators。
- reverse by effective volume。
- exact q／k selection validation 與來源語意。
- source discrepancy regression。

### Out of scope

- 將一份來源的結果當成另一份來源的產品選型、未核准的多餐期尖峰政策。

### Acceptance

- QA-001 LEG 四案例與 reverse tests 通過。
- B／C 類未選 exact k 時回 INSUFFICIENT_DATA。
- L/h、L、名目／有效容積不混用。

### Stop conditions

- 需求要求用一份來源的參數補另一份來源的缺口。
- 多餐期 aggregation 未明示。

### Evidence

- unit、source discrepancy、unit conversion tests。

---

## DEV-005：實作雙軌 orchestrator 與放行狀態

狀態：完成  
節點類型：交付點  
是否計入產品交付：是

### Scope

- TrackAssessment、CalculationRun、steps、warnings persistence。
- per-track savepoint、parent transaction、idempotency、optimistic version。
- calculation API request／response／problem+json。
- COMPLETE、COMPLETE_WITH_REMINDER、BLOCKED 與 releaseEligible。

### Out of scope

- 完整案件 UI、覆核與 PDF。

### Acceptance

- DUAL-001～007 全通過。
- 一軌失敗不回滾另一軌；零有效軌才 BLOCKED。
- 未完成軌沒有 run／result。
- 同 idempotency key 不重複建立 run。

### Stop conditions

- 任一實作重新引入已廢止的部分完成狀態，或要求兩軌都完成才放行。
- 以 controller 捕捉後偽造成功結果。

### Evidence

- integration、transaction、DB constraint、API contract tests。

---

## DEV-006：建立產品與證書主檔及匹配（跳過）

狀態：跳過  
節點類型：交付點  
是否計入產品交付：否

### 決策

使用者於 2026-07-13 明確要求「證書匹配功能拿掉不需要」。依 HD-07 與 ADR-004，本 DEV 不實作、不恢復，也不保留 product／certificate schema、API、UI 或測試骨架。

如未來重新提出此能力，必須建立新的 Human Decision Brief、ADR 與新 DEV ID，不得把本 DEV 改回待排。

---

## DEV-007：建立案件清單、任務精靈與計算工作台

狀態：完成  
節點類型：交付點  
是否計入產品交付：是

### Scope

- SPEC-002 `/cases`、`/cases/new`、案件工作台。
- 五任務、三模式、動態欄位、雙軌結果與 details drawer。
- Now What states、visible error recovery、RWD、accessibility。
- 雲端內部使用的登入、session 過期、無權限與安全返回狀態。

### Out of scope

- 覆核、核發、規則管理者完整 UI。

### Acceptance

- 任一有效軌時 primary CTA 可完成報告草稿，送審後再進入最終覆核。
- 390、1024、1440 主要流程可操作。
- 無 visible runtime errors、假數值、長篇首屏教學。

### Stop conditions

- UI 自行重算公式。
- 非阻擋提醒讓主要 CTA disabled。

### Evidence

- component tests、E2E、accessibility、viewport screenshots。

---

## DEV-008：建立工程覆核、退回、override 與 audit

狀態：完成  
節點類型：交付點  
是否計入產品交付：是

### Scope

- lifecycle transitions、submit／review／return。
- review checklist、override approval、audit events。
- server-side permissions、revision creation。
- 同一 actor 可依序編製、提交、覆核、核准 override 與核發；各責任事件分開保存。

### Out of scope

- 正式 SSO provider、separation-of-duty gate。

### Acceptance

- 非法狀態轉換與權限繞過被阻擋。
- COMPLETE_WITH_REMINDER 可完成報告草稿，送審後可完成最終覆核。
- 同一帳號不需切換角色或等待另一人即可完成覆核與核發。
- preparedBy、reviewedBy、issuedBy 可相同，但 audit 事件、時間與 checklist 完整。
- 退回原因與下一步可見。
- ISSUED 修改只能建立新 revision。

### Stop conditions

- 覆核／override 無 actor、時間、理由或前後值。
- 直接覆寫 issued data。

### Evidence

- state、permission、audit、revision integration／E2E tests。

---

## DEV-009：建立 ReportSnapshot 與 PDF

狀態：完成  
節點類型：交付點  
是否計入產品交付：是

### Scope

- snapshot schema、hash、immutability、issue transaction。
- deterministic HTML 與 PDF adapter。
- 兩份計算依據、對照與單份完成模板。
- report history、download、supersede。
- 報告限制章節明示未執行產品型號或證書符合性判定。

### Out of scope

- 正式編號格式決策、電子簽章、客戶 portal。

### Acceptance

- PDF 只讀 snapshot；live data 變更後重新 render 不變。
- 未完成軌標示正確，沒有假值。
- PDF 不含產品／證書匹配狀態或相符型號結論。
- 全頁 render 無黑方塊、裁切、重疊或缺頁。

### Stop conditions

- PDF template 重算或查 live rule。
- snapshot hash 不可重現。

### Evidence

- 四種 PDF、render PNG、snapshot／content regression。

---

## DEV-010：完成自動化回歸與 UI QC 套件

狀態：完成  
節點類型：QA/QC  
是否計入產品交付：否

### Scope

- 落實 QA-001 全部 Critical／High 測試。
- fixtures 與 production formula 分離。
- E2E、visible error sweep、viewport、PDF render automation。
- QC evidence template。

### Acceptance

- G1～G3 所有 gate 可由單一文件化命令重跑。
- 失敗時指出 DEV、fixture、預期／實際與 evidence path。
- UI 自動證據與 manual evidence 都齊備。

### Stop conditions

- 測試以 production calculator 產生 expected 值。
- 只有 build／lint 就宣稱 UI 或 PDF 通過。

### Evidence

- test suite、report、screenshots、coverage、flaky retry record。

---

## DEV-011：完成本地 RD／QA／QC 驗收

狀態：自動化與本地 QC 通過；待人類提供 3～5 個去識別實際案件完成 parallel pilot  
節點類型：關卡  
是否計入產品交付：否

### Scope

- 以 3～5 個去識別真實情境做平行試算。
- QC 獨立重算兩份來源案例。
- 驗證四種 PDF、角色、修訂、audit、RWD。
- 驗證同一帳號端到端完成編製、覆核與核發，以及匿名／session／權限負向路徑。
- 整理本地交付 boundary 與殘留風險。

### Acceptance

- QA-001 最終通過標準成立。
- 8 個有效交付點全部有完成證據；DEV-006 以 ADR-004 跳過證據排除。
- 無 P0／P1 defect；未充分驗證項目不得藏在通過結論。

### Stop conditions

- 真實案件含未去識別客戶敏感資訊。
- 任一官方案例無法重現或 issued snapshot 改變。

### Evidence

- QC report、parallel calculation diff、PDF、screenshots、Git status／commit boundary。

---

## DEV-012：正式環境發版

狀態：`Release Gate Required`；本輪未要求  
節點類型：關卡  
是否計入產品交付：否

只保存 re-entry trigger：DEV-011 通過，且使用者明確提出部署、上線或 release。Firebase 拓撲已由 ADR-007 固定；屆時交由 deployment release gate 建立 project、Auth、角色、正式報告編號、資料備份、rollback 與 production smoke；目前不得執行。

---

## DEV-013：調整建案基本資料與餐飲類型步驟

狀態：完成
節點類型：開發點
父交付點：DEV-007
是否計入產品交付完成：否
原始需求邊界：使用者 2026-07-14 指定餐飲類型移到下一步，其他基本資料全部選填

### 任務目標

讓工程人員可在資料尚不完整時先建立案件，並在真正開始內政部給排水規範（附錄 5）計算時才明確選擇餐飲類型。

風險等級：Medium

### 開發範圍

- 客戶、地點、案件名稱、用途及資料提供者／證據改為選填，往返步驟保留已輸入資料。
- 建案契約只要求任務與模式；餐飲類型不在建案 payload，建案時 `dining_type` 為 null。
- 內政部給排水規範（附錄 5）計算資料的餐飲類型不預選，未選時由原生 required validation 阻擋計算。
- 空白案件名稱以案件編號顯示；客戶與地點顯示「未填」替代文字；報告快照使用可讀 fallback。

### 驗收與證據

- Schema unit：選填欄位省略或全空白皆通過；共 21 tests passed。
- 靜態關卡：format、lint、typecheck、production build passed。
- E2E：desktop 1440、tablet 1024、mobile 390 共 9 tests passed。
- 手動 QC：全空白建案成功、返回資料保留、餐飲類型只在下一頁、未選不可計算、console 0 errors。
- 視覺證據：`output/playwright/dev-013-new-case-1440.png`、`output/playwright/dev-013-new-case-390.png`、`output/playwright/dev-013-workbench-1440.png`、`output/playwright/dev-013-workbench-390.png`。

### 變更紀錄

- 2026-07-14：完成 RD、QA、QC 與本地整合驗證。

---

## DEV-015：重構客戶報告的輸入、計算依據與輸出

狀態：完成
節點類型：開發點
父交付點：DEV-009
是否計入產品交付完成：否
原始需求邊界：使用者 2026-07-15 要求整份報告可明確辨識輸入條件與輸出結果，並執行全部優化方案

### 任務目標

客戶在第一個資訊區塊即可知道本次提供哪些條件、採用哪份計算依據、得到哪些結果；需要查算式時，每個代入數字都有名稱、單位與資料角色。

風險等級：Medium

### 開發範圍

- 以不可變 ReportSnapshot 的輸入與結果建立純顯示模型，不變更公式、資料庫或 lifecycle。
- 移除空白封面與重複摘要卡，改為「本次輸入條件 → 計算依據 → 本次設計結果」。
- 結果以計算依據對照表呈現，區分「未完成」與「此依據無法計算」。
- 完整計算列出各方法使用條件，以及符號、代表內容、數值、單位、資料角色、數值算式與計算結果。
- 隱藏未使用欄位；缺少資料時顯示人類可理解的說明，不填入 0 或推測值。

### 驗收條件

- 第一個資訊區塊 5 秒內可回答輸入、計算依據與輸出。
- 每個數值算式的代入值可追溯到名稱、單位與「本案條件／計算依據參數／計算中間值」。
- `L/h` 保留原始值並另列 `L/min`；`kg` 與 `L` 不做錯誤比對；報告不存在 `kg/day`。
- 四種範例 PDF 與指定真實案件預覽無裁切、重疊、可見錯誤或持續重新載入。

### 驗收與證據

- 靜態與自動化：lint、typecheck、本次檔案 Prettier／diff check、25 unit tests passed。
- PDF：現行 2 頁、臺北市 2 頁、雙方法 3 頁、雙方法單軌 2 頁；共 9 頁 A4 render，逐頁確認無孤立標題、空白頁、裁切、重疊、黑方塊或表格斷裂。
- 地端真實案件：`/cases/85b0d50f-c8fe-494b-802f-e9e1c5e29368/report` 顯示輸入、輸出、三種資料角色、原始／統一流量與完整數值算式；無 `kg/day`、系統審核計畫、水平溢位、可見錯誤或 console warning／error。
- 穩定性：重新載入後 1.5 秒觀察期間 URL 與內容維持穩定，未再發生持續重新載入。

### 變更紀錄

- 2026-07-15：建立 DEV-015，開始客戶報告資訊架構與計算過程重構。
- 2026-07-15：完成 RD、單元回歸、四種 PDF QC 與指定地端案件 browser QC。
- 2026-07-15：依客戶比較需求移除摘要中的原始流量列，結果對照表統一使用 `L/min`；`L/h` 僅保留於完整計算過程。
- 2026-07-15：案件工作台移除雙軌結果卡片，改用與客戶報告共用的「本次設計結果」顯示模型與比較表，避免輸出名稱、狀態與單位分歧。

---

## DEV-016：加強輸入條件來源分類與選值溝通

狀態：完成
節點類型：開發點
父交付點：DEV-007、DEV-009、DEV-015
是否計入產品交付完成：否
原始需求邊界：使用者 2026-07-15 要求以產品經理角度評估輸入條件類型，並先 commit 當前版本後開始實作第一階段優化

### 任務目標

讓工程人員與客戶能分辨每個輸入條件是案件資料、工程選值、設備資料、實測資料或覆寫值；對需要工程判斷的欄位，要求留下可追溯理由，但不把進階計算路徑一次塞進主要表單。

風險等級：Medium

### 開發範圍

- 以既有 `input_payload` 保存選值來源類型、選值原因、證據備註與內政部實際使用時間覆寫值，不新增資料表或 migration。
- 工作台加入完成狀態 badge：標準條件完成、使用特殊條件完成、僅完成一份依據、使用設備資料、工程選值已記錄或缺少選值理由。
- 工作台計算資料區改為固定矩陣：屬性、條件、輸入值、說明；來源屬性以短 chip 固定於第一欄，說明固定於 icon 欄，輸入框採一致藍色系以降低版面噪音。
- 內政部 `actualUseMinutes` 放在「特殊條件／有資料再填」，避免干擾一般案件。
- 臺北市 q、t、exact k、有效容積等參數以「選值來源類型／選值原因／證據備註」結構化輸入，並向下相容舊的 `selectionReason`；q 欄位提供臺北市用水量表摘要。
- 客戶報告輸入條件表改為「條件／輸入值／類型／來源或理由」，與工作台共用完整性判斷。

### 驗收條件

- 標準案件不需要填特殊條件即可完成計算，且顯示「標準條件完成」。
- 使用 `actualUseMinutes`、實測水量、多餐期或設備資料時，報告與工作台要明確標示特殊條件或設備資料。
- 工程選值欄位不得只留下散文；至少保存來源類型與原因，證據不足時可明確看出缺口。
- 計算資料欄位需能逐列比對屬性、條件與輸入值；q 參考表與特殊條件不得破壞主要欄位對齊。
- 新欄位不得改變既有計算核心；只有 `actualUseMinutes` 依 SPEC-001 允許取代內政部 t 表值。

### 驗收與證據

- 靜態與自動化：`npx vitest run tests/unit/report-presentation.test.ts tests/unit/report-html.test.ts`，2 files／6 tests passed。
- 型別與品質：`npm run typecheck` passed；`npm run lint` passed；本次修改檔案已 Prettier。
- 地端工作台：`http://localhost:3100/cases/18e03128-72f9-46ac-9cd5-471c31bf3cd3` 顯示屬性／條件／輸入值／說明固定矩陣、特殊條件 details、結構化選值欄位；q 參考表展開後四欄完整顯示；console 無產品錯誤。
- 地端報告：`/cases/00e25e16-9894-45f7-a267-4c3e6f32b116/report` 顯示完整性 badge 與「條件／輸入值／類型／來源或理由」表格；console 無產品錯誤。

### 變更紀錄

- 2026-07-15：建立 DEV-016，完成 baseline commit 後實作輸入來源分類、結構化選值理由、特殊條件區與報告來源／理由欄。
- 2026-07-16：計算資料區改為屬性／條件／輸入值／說明固定矩陣；q 參考表改為展開列，特殊條件維持降層但不破壞主要欄位對齊。
- 2026-07-16：矩陣欄位壓縮為單列顯示；窄版改為矩陣內部橫向捲動，避免屬性、條件與輸入值拆成三行。

---

## DEV-017：統一案件工作台計算提交按鈕位置

狀態：完成
節點類型：開發點
父任務：DEV-015、DEV-016
是否計入產品交付完成：否
原始需求邊界：使用者 2026-07-16 要求「重新計算」移到「計算資料」結束位置，第一次計算顯示「開始計算」，修改後才改成「重新計算」。

### 任務目標

讓使用者依「填寫計算資料 → 開始計算／重新計算 → 查看本次設計結果 → 完成報告草稿」順序操作，避免同一個計算提交動作分散在標題列或結果區。

### 開發範圍

- 從計算資料標題列移除計算提交按鈕。
- 將送出計算按鈕固定置於「計算資料」區塊底部。
- 尚無計算狀態、評估或結果時顯示「開始計算」。
- 已有任一計算狀態、評估或結果時顯示「重新計算」，並使用與「完成報告草稿」一致的主要按鈕呈現。
- 本次設計結果區不再重複放置「重新計算」；「完成報告草稿」維持在結果區後續流程 CTA。
- 不改變計算公式、API 或生命週期。

### 驗收條件

- 指定案件的「計算資料」底部可見「重新計算」，且按鈕呈現與「完成報告草稿」一致；結果表下方不再出現重複的「重新計算」。
- 新建尚未計算案件的「計算資料」底部可見「開始計算」。
- 計算資料標題列不再顯示「開始計算」或「重新計算」。
- 1440 與 390 viewport 無頁面水平 overflow、裁切或不可操作按鈕。
- 其他狀態的覆核、預覽與核發下一步不受影響。

### 驗收與證據

- `npm run typecheck` passed。
- `npm run lint` passed。
- 指定案件 `/cases/531f63c0-2d7f-4832-aa44-8ebb73d388af` browser snapshot 顯示結果表後方的兩個操作按鈕。
- Playwright screenshots：`output/playwright/case-workbench-actions-after-results-desktop-full.png`、`output/playwright/case-workbench-actions-after-results-narrow.png`。
- 1440 viewport `document.body.scrollWidth = 1440`；390 viewport `document.body.scrollWidth = 375`，未形成頁面水平 overflow。
