# 文件地圖｜油脂截留器雙軌計算系統

文件狀態：`Local Engineering Complete — Human Pilot Pending`  
權威版本：`2.1`
最後更新：`2026-07-14`
專案根目錄：`C:\VIBE CODING\grease-trap-calculation-system`

## 冷啟動讀取順序

下一輪 AI、PM、RD、QA 或 QC 應依序讀取：

1. 本文件：掌握權威來源、目前狀態、下一步及阻擋。
2. [dev_task.md](dev_task.md)：確認已完成交付、Human Pilot 與 Release Gate 的重入條件。
3. [SPEC-001-functional-engineering.md](specs/SPEC-001-functional-engineering.md)：理解功能語意、公式、資料、API 與狀態機。
4. [SPEC-002-ui-ux.md](specs/SPEC-002-ui-ux.md)：理解畫面、CTA、防呆及可視狀態。
5. 與該 DEV 直接相關的 ADR 與 [QA-001-validation-plan.md](qa/QA-001-validation-plan.md)。

不得只憑聊天記憶或 README 開始實作。

## Active 文件

| 文件 | 地位 | 主要讀者 | 使用時機 |
|---|---|---|---|
| [project_overview.md](project_overview.md) | End-State 與 phase 邊界 | PM、Tech Lead | 專案續接、範圍判斷 |
| [dev_task.md](dev_task.md) | 唯一 DEV 排序與執行入口 | PM、RD、QA、QC | 選下一任務、更新狀態 |
| [SPEC-001-functional-engineering.md](specs/SPEC-001-functional-engineering.md) | 功能與工程權威規格 | RD、QA、QC | 實作計算、資料、API、報告 |
| [SPEC-002-ui-ux.md](specs/SPEC-002-ui-ux.md) | UI／UX 權威規格 | RD、QA、QC | 畫面、流程與瀏覽器驗證 |
| [ADR-001-dual-track-first-class.md](decisions/ADR-001-dual-track-first-class.md) | 雙軌一級功能決策 | 全角色 | 模式與法規語意衝突時 |
| [ADR-002-one-valid-track-release.md](decisions/ADR-002-one-valid-track-release.md) | 任一有效軌可放行決策 | 全角色 | 狀態、覆核、核發衝突時 |
| [ADR-003-modular-web-architecture.md](decisions/ADR-003-modular-web-architecture.md) | 技術架構決策 | Tech Lead、RD | 建立專案骨架與模組邊界時 |
| [ADR-004-exclude-product-certificate-matching.md](decisions/ADR-004-exclude-product-certificate-matching.md) | 排除產品／證書匹配 | 全角色 | Scope、反推輸入或報告內容衝突時 |
| [ADR-005-single-user-review-issue.md](decisions/ADR-005-single-user-review-issue.md) | 單人編製／覆核／核發 | 全角色 | 權限、狀態或 audit 衝突時 |
| [ADR-006-cloud-internal-access-boundary.md](decisions/ADR-006-cloud-internal-access-boundary.md) | 雲端內部存取邊界 | Tech Lead、RD、QA | Auth、API exposure 或 release 邊界時 |
| [QA-001-validation-plan.md](qa/QA-001-validation-plan.md) | 第一階段驗證權威計畫 | QA、QC、RD | 測試設計、驗收與證據蒐集 |
| [QC-001-local-acceptance.md](qa/QC-001-local-acceptance.md) | 本地實作與驗收事實紀錄 | PM、QA、QC、Release Owner | 查驗測試、PDF、UI 證據與殘留人工事項 |

## Human Decision Brief

| ID | 已確認決策 | 決策來源 |
|---|---|---|
| HD-01 | 現行 Q/G 與舊版 Q/V 均納入第一階段，不延後任一軌。 | 使用者 2026-07-13 |
| HD-02 | 兩軌都可由內部工程人員獨立計算、覆核並產生報告章節，法規時效分開揭露。 | 使用者對話與 v0.4 |
| HD-03 | 不以既有人工計算書作為新系統規格來源。 | 使用者 2026-07-13 |
| HD-04 | 第一階段為內部網頁系統；客戶只接收覆核後的設計計算書。 | 使用者選項決策與 v0.4 |
| HD-05 | 人數→流量、人數→設計、面積→流量、面積→設計、設計→人數及面積反推，兩軌皆須獨立覆蓋。 | 使用者 2026-07-13 |
| HD-06 | 雙軌只要一軌資料足夠且計算有效，即可進入覆核並在覆核後核發；另一軌僅提醒。 | 使用者 2026-07-13 |
| HD-07 | HCS-1A：計算成立即可核發；並依使用者補充完整移除產品型號與證書匹配功能。 | 使用者 2026-07-13 |
| HD-08 | HCS-2C：同一位使用者可完成編製、覆核與正式核發，系統只要求責任步驟與 audit 完整。 | 使用者 2026-07-13 |
| HD-09 | HCS-3B：第一版 End-State 為雲端網路系統，授權內部人員可從公司外登入。 | 使用者 2026-07-13 |
| HD-10 | 建案時餐飲類型移至後續計算資料；客戶、地點、案件名稱、用途及資料提供者／證據全部選填。 | 使用者 2026-07-14 |

已拒絕方向：強制不同帳號覆核、單機限定、公司內網限定，以及內建產品／證書匹配。重新引入任一方向都需要新的 Human Decision Brief 與 ADR。

## 權威順序

發生衝突時依下列順序處理：

1. 最新使用者明確決策。
2. ADR-004～006 的 scope、責任與雲端存取邊界。
3. ADR-002 的雙軌放行狀態與 ADR-001 的雙軌隔離規則。
4. SPEC-001 的公式、參數、資料、API 與報告契約。
5. SPEC-002 的 UI 呈現與操作契約。
6. QA-001 的驗收與證據要求。
7. 舊版 v0.4 架構文件只作遷移來源；本專案文件包是後繼權威來源。

任何新規格不得靜默覆蓋舊規則；必須標示 `Intentional replacement`、`Compatible exception` 或 `Unresolved conflict`。

## 目前狀態與下一步

- 文件與程式：8 個有效產品交付點全部完成；DEV-006 依 ADR-004 跳過；DEV-013 已完成 DEV-007 的建案流程調整。
- 本地工程：固定啟動、PostgreSQL、雙軌計算、案件／覆核／audit、不可變快照、四種 PDF 與三 viewport UI 均完成。
- QA／QC：21 個單元、9 個既有整合、9 個三 viewport E2E、production build 與 22 頁 PDF render 已通過；詳見 QC-001。
- Git：repository 已初始化；本輪建立本地交付 commit boundary，不執行 merge／PR。
- 下一步：人類提供 3～5 個去識別實際案件與人工預期值，完成 DEV-011 parallel pilot。
- 本輪未執行：雲端 provider／正式 Auth 選型、部署、release、rollback、production smoke。

## Blocker 與 Re-entry Trigger

目前沒有 P0／P1 defect。下列事項不阻擋本地工程交付，但在對應邊界前必須重新進入：

- DEV-011 真實案件平行試算：提供 3～5 個去識別案件、人工結果與可接受差異後恢復。
- 正式環境身份提供者、託管平台與成本：雲端 End-State 已固定，特定 provider 進入 release gate 前確認。
- 正式報告編號格式：首次 production release 前確認；local/dev 僅使用草稿識別碼。
- 法規或主管機關來源版本變更：啟用新 RuleSet，不回寫既有報告。

## 來源證據位置

- 舊版計算摘錄：`J:\共用雲端硬碟\99_總經理室Google雲端\法規標準\法規-產品\臺北市政府工務局衛生下水道工程處_油脂截留槽計算.pdf`
- 舊版完整說明：`J:\共用雲端硬碟\99_總經理室Google雲端\法規標準\法規-產品\臺北市政府工務局衛生下水道工程處_油脂截留器使用維護及設計說明.pdf`
- 現行設計規範官方 PDF：`https://www.nlma.gov.tw/filesys/file/chinese/publication/law2/1090811791a.pdf`
- 舊版 v0.4 來源文件：`C:\Users\user\Documents\Codex\2026-07-13\new-chat-3\outputs\鉦富_油脂截留器雙軌計算系統_開發文件_v0.4.md`

公式、表格與雜湊值已收斂於 SPEC-001；不得在 UI、PDF 模板或測試中另抄一套公式。

## 文件更新責任

- 產品語意、狀態機、公開 API、資料模型或權限變更：先更新／新增 ADR，再同步 SPEC、QA 與 dev_task。
- 局部工程決策：更新對應 SPEC 與 dev_task，不需新增 ADR。
- RD／QA／QC 執行結果：更新 dev_task；正式證據量大時才新增 qc／report 文件。
- Release artifacts：只有使用者提出合併、PR、部署、上線或 release 後才建立。
