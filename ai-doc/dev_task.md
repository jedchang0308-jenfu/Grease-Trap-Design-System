# Dev Task｜油脂截留器雙軌計算系統

文件狀態：`Local Engineering Complete — Human Pilot Pending`  
版本：`2.0`  
最後更新：`2026-07-13`  
本輪執行邊界：本地 RD／自動化 QA／UI 與 PDF QC 已完成；真實案件平行試算待人類輸入；release 未獲指令  
產品完成基準：8 個有效交付點，目前完成 8／8（100%）；DEV-006 已由使用者決策跳過，不計入分母

## 總任務清單

- ✓ DEV-001 [交付點] [完成] [P0] 建立本地可啟動的專案骨架
  - 摘要：建立固定啟動入口、模組目錄、型別／格式／測試基礎與本地資料庫連線，讓後續 DEV 有一致執行環境。
  - 來源 ID：`GTC-PH1-FOUNDATION-001`
  - 父任務：無
  - 下一步：無；固定入口為 `npm run dev:local`／`http://localhost:3100`
  - 證據：Node 24、Next.js 16、Docker PostgreSQL 18、lockfile、health、lint、typecheck、build、Git boundary
  - 計入交付：是

- ✓ DEV-002 [交付點] [完成] [P0] 建立版本化來源、規則與參數庫
  - 摘要：把現行 A-34～A-37、舊版 Q/V 參數、來源雜湊與 discrepancy 建成可查、不可靜默修改的 seed data。
  - 來源 ID：`GTC-PH1-RULES-002`
  - 父任務：無
  - 下一步：只有新法規來源版本出現時建立新 RuleSet，不回寫 ACTIVE 版本
  - 證據：2 份 migration、seed checksum、ACTIVE immutability、factor counts 與 DB integration tests
  - 計入交付：是

- ✓ DEV-003 [交付點] [完成] [P0] 實作現行 Q/G 正向與反向計算核心
  - 摘要：交付現行人數、全面積、輸入 Q/G 能力反推、A-36 內插與來源例外的高精度純計算核心。
  - 來源 ID：`GTC-PH2-CURRENT-003`
  - 父任務：無
  - 下一步：無
  - 證據：CUR 官方案例、A-36 exception／interpolation、precision、strict reverse unit tests
  - 計入交付：是

- ✓ DEV-004 [交付點] [完成] [P0] 實作舊版 Q/V 正向與反向計算核心
  - 摘要：交付舊版人數、餐期平均、實測、面積與有效容積反推，並防止來源錯字與參數猜值。
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
  - 摘要：從 reviewed revision 建立不可變快照，產生現行、舊版、雙軌與單軌完成的正式報告版型。
  - 來源 ID：`GTC-PH3-REPORT-009`
  - 父任務：無
  - 下一步：正式報告編號格式於首次 release 前由人類決定
  - 證據：snapshot／issued immutability、四份 A4 PDF、22 頁 render PNG、content regression
  - 計入交付：是

- ✓ DEV-010 [QA/QC] [完成] [P1] 完成自動化回歸與 UI QC 套件
  - 摘要：將 QA-001 的計算、API、狀態、權限、E2E、PDF 與 viewport 驗證落成可重跑證據。
  - 來源 ID：`GTC-PH4-QA-010`
  - 父任務：DEV-003、DEV-004、DEV-005、DEV-007、DEV-008、DEV-009
  - 下一步：新功能或 bugfix 必須維持同一 regression gate
  - 證據：19 unit、9 integration、9 E2E、production build、screenshots、visible error／overflow sweep
  - 計入交付：否

- ⚠ DEV-011 [關卡] [自動化通過／待人類實例] [P1] 完成本地 RD／QA／QC 驗收
  - 摘要：以真實案件 fixture 完成全流程，確認第一階段產品功能達到本地交付標準。
  - 來源 ID：`GTC-PH4-ACCEPTANCE-011`
  - 父任務：DEV-001～DEV-005、DEV-007～DEV-009
  - 下一步：人類提供 3～5 個去識別實際案件、人工結果與可接受差異後執行 parallel diff
  - 阻塞／恢復條件：真實案件證據不可由 AI 假造；收到去識別資料後恢復
  - 證據：QC-001、官方／舊版案例重算、四種 PDF、三 viewport E2E；parallel diff 待補
  - 計入交付：否

- ↷ DEV-012 [關卡] [延後] [P2] [Release Gate Required] 正式環境發版
  - 摘要：雲端內部使用的 End-State 已固定；集中處理未來的 provider、Auth、正式報告編號、部署與 production gate，不預寫 release artifacts。
  - 來源 ID：`GTC-RELEASE-012`
  - 父任務：DEV-011
  - 下一步：等待使用者明確提出部署、上線或 release
  - 恢復條件：DEV-011 通過且使用者提出 release 型指令
  - 計入交付：否

## Phase 執行順序

```text
G1 Foundation: DEV-001 → DEV-002
                     ├→ DEV-003 ─┐
G2 Calculation:      └→ DEV-004 ─┴→ DEV-005
G3 Workflow: DEV-005 → DEV-007 → DEV-008 → DEV-009
G4 Acceptance: DEV-003～005、007～009 → DEV-010 → DEV-011
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

## DEV-003：實作現行 Q/G 正向與反向計算核心

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

## DEV-004：實作舊版 Q/V 正向與反向計算核心

狀態：完成  
節點類型：交付點  
是否計入產品交付：是

### Scope

- legacy single period、source arithmetic mean、measured、area calculators。
- reverse by effective volume。
- exact q／k selection validation 與 historical semantics。
- source discrepancy regression。

### Out of scope

- 將舊版結果當現行選型、未核准的多餐期尖峰政策。

### Acceptance

- QA-001 LEG 四案例與 reverse tests 通過。
- B／C 類未選 exact k 時回 INSUFFICIENT_DATA。
- L/h、L、名目／有效容積不混用。

### Stop conditions

- 需求要求用現行參數補舊版缺口。
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

- 任一有效軌時 primary CTA 可提交／繼續覆核。
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
- COMPLETE_WITH_REMINDER 可完成覆核。
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
- 現行、舊版、雙軌、雙軌單軌完成模板。
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
- QC 獨立重算官方與舊版案例。
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

只保存 re-entry trigger：DEV-011 通過，且使用者明確提出部署、上線或 release。雲端內部使用的拓撲已由 ADR-006 固定；屆時交由 deployment release gate 決定 provider、Auth、正式報告編號、資料備份、migration、rollback 與 production smoke；目前不得預寫或執行。
