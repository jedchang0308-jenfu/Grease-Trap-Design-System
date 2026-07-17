# 文件地圖｜油脂截留器雙軌計算系統

文件狀態：`Public Firebase Pilot Release In Progress`
權威版本：`2.4`
最後更新：`2026-07-17`
專案根目錄：`C:\VIBE CODING\Grease-Trap-Design-System`

## 冷啟動讀取順序

下一輪 AI、PM、RD、QA 或 QC 應依序讀取：

1. 本文件：掌握權威來源、目前狀態、下一步及阻擋。
2. [dev_task.md](dev_task.md)：確認已完成交付、Human Pilot 與 Release Gate 的重入條件。
3. [SPEC-001-functional-engineering.md](specs/SPEC-001-functional-engineering.md)：理解功能語意、公式、資料、API 與狀態機。
4. [SPEC-002-ui-ux.md](specs/SPEC-002-ui-ux.md)：理解畫面、CTA、防呆及可視狀態。
5. 與該 DEV 直接相關的 ADR 與 [QA-001-validation-plan.md](qa/QA-001-validation-plan.md)。

不得只憑聊天記憶或 README 開始實作。

## Active 文件

| 文件                                                                                                         | 地位                    | 主要讀者                  | 使用時機                             |
| ------------------------------------------------------------------------------------------------------------ | ----------------------- | ------------------------- | ------------------------------------ |
| [project_overview.md](project_overview.md)                                                                   | End-State 與 phase 邊界 | PM、Tech Lead             | 專案續接、範圍判斷                   |
| [dev_task.md](dev_task.md)                                                                                   | 唯一 DEV 排序與執行入口 | PM、RD、QA、QC            | 選下一任務、更新狀態                 |
| [SPEC-001-functional-engineering.md](specs/SPEC-001-functional-engineering.md)                               | 功能與工程權威規格      | RD、QA、QC                | 實作計算、資料、API、報告            |
| [SPEC-002-ui-ux.md](specs/SPEC-002-ui-ux.md)                                                                 | UI／UX 權威規格         | RD、QA、QC                | 畫面、流程與瀏覽器驗證               |
| [ADR-001-dual-track-first-class.md](decisions/ADR-001-dual-track-first-class.md)                             | 雙軌一級功能決策        | 全角色                    | 模式與法規語意衝突時                 |
| [ADR-002-one-valid-track-release.md](decisions/ADR-002-one-valid-track-release.md)                           | 任一有效軌可放行決策    | 全角色                    | 狀態、預覽、核發衝突時               |
| [ADR-003-modular-web-architecture.md](decisions/ADR-003-modular-web-architecture.md)                         | 技術架構決策            | Tech Lead、RD             | 建立專案骨架與模組邊界時             |
| [ADR-004-exclude-product-certificate-matching.md](decisions/ADR-004-exclude-product-certificate-matching.md) | 排除產品／證書匹配      | 全角色                    | Scope、反推輸入或報告內容衝突時      |
| [ADR-005-single-user-review-issue.md](decisions/ADR-005-single-user-review-issue.md)                         | 一人作業與直接核發      | 全角色                    | 權限、狀態或核發流程衝突時           |
| [ADR-006-cloud-internal-access-boundary.md](decisions/ADR-006-cloud-internal-access-boundary.md)             | 歷史存取決策（被取代）  | Tech Lead、RD、QA         | 查詢原始內部帳號決策時               |
| [ADR-007-firebase-managed-architecture.md](decisions/ADR-007-firebase-managed-architecture.md)               | Firebase 後繼架構決策   | Tech Lead、RD、QA、QC     | 資料、Auth、Storage 或本機開發時     |
| [ADR-008-public-link-anonymous-access.md](decisions/ADR-008-public-link-anonymous-access.md)                 | 公開連結存取決策        | Tech Lead、RD、QA、QC     | Auth、API exposure 或 release 邊界時 |
| [QA-001-validation-plan.md](qa/QA-001-validation-plan.md)                                                    | 第一階段驗證權威計畫    | QA、QC、RD                | 測試設計、驗收與證據蒐集             |
| [QC-001-local-acceptance.md](qa/QC-001-local-acceptance.md)                                                  | 本地實作與驗收事實紀錄  | PM、QA、QC、Release Owner | 查驗測試、PDF、UI 證據與殘留人工事項 |

## Human Decision Brief

| ID    | 已確認決策                                                                                         | 決策來源              |
| ----- | -------------------------------------------------------------------------------------------------- | --------------------- |
| HD-01 | 內政部給排水規範（附錄 5）與臺北市工務局衛工處設計說明均納入第一階段，不延後任一份計算依據。       | 使用者 2026-07-13     |
| HD-02 | 兩軌都可由內部工程人員獨立計算並產生報告章節，法規時效分開揭露。                                   | 使用者對話與 v0.4     |
| HD-03 | 不以既有人工計算書作為新系統規格來源。                                                             | 使用者 2026-07-13     |
| HD-04 | 第一階段為內部網頁系統；客戶只接收核發後的設計計算書。                                             | 使用者選項決策與 v0.4 |
| HD-05 | 人數→流量、人數→設計、面積→流量、面積→設計、設計→人數及面積反推，兩軌皆須獨立覆蓋。                | 使用者 2026-07-13     |
| HD-06 | 雙軌只要一軌資料足夠且計算有效，即可預覽並核發；另一軌僅提醒。                                     | 使用者 2026-07-13     |
| HD-07 | HCS-1A：計算成立即可核發；並依使用者補充完整移除產品型號與證書匹配功能。                           | 使用者 2026-07-13     |
| HD-08 | HCS-2C：同一位使用者可完成建案、計算、預覽與正式核發，不要求切換帳號或等待他人。                   | 使用者 2026-07-13     |
| HD-09 | HCS-3B：第一版 End-State 為雲端網路系統，授權內部人員可從公司外登入。                              | 使用者 2026-07-13     |
| HD-10 | 建案時餐飲類型移至後續計算資料；客戶、地點、案件名稱、用途及資料提供者／證據全部選填。             | 使用者 2026-07-14     |
| HD-11 | 核發前必須可預覽完整報告及其計算依據；預覽不再進入送審或覆核工作台。                               | 使用者 2026-07-15／2026-07-17 |
| HD-12 | 案件不論生命週期狀態均可由授權工程人員直接刪除；刪除案件時一併刪除所有修訂、計算與報告紀錄。       | 使用者 2026-07-15     |
| HD-13 | 舊資料可捨棄；先提交目前版本，再以 Firebase Auth、Firestore、Storage 與 App Hosting 重構供同事共同使用。 | 使用者 2026-07-17     |
| HD-14 | 移除送審、覆核、退回與最終審核機制，系統輕量化為一人作業模式；計算成立後直接預覽並核發。           | 使用者 2026-07-17     |
| HD-15 | 第一版不設定帳號角色；任何取得網址的人可直接使用，瀏覽器以 Firebase Anonymous Auth 自動建立 session。 | 使用者 2026-07-17     |

已拒絕方向：強制不同帳號覆核、獨立送審／覆核工作流、單機限定、公司內網限定、首版帳號／角色配置，以及內建產品／證書匹配。重新引入任一方向都需要新的 Human Decision Brief 與 ADR。

## 權威順序

發生衝突時依下列順序處理：

1. 最新使用者明確決策。
2. ADR-008 的公開連結存取政策、ADR-007 的 Firebase 架構，以及 ADR-004～005 未被取代的 scope 與責任邊界。
3. ADR-002 的雙軌放行狀態與 ADR-001 的雙軌隔離規則。
4. SPEC-001 的公式、參數、資料、API 與報告契約。
5. SPEC-002 的 UI 呈現與操作契約。
6. QA-001 的驗收與證據要求。
7. 舊版 v0.4 架構文件只作遷移來源；本專案文件包是後繼權威來源。

任何新規格不得靜默覆蓋舊規則；必須標示 `Intentional replacement`、`Compatible exception` 或 `Unresolved conflict`。

## 目前狀態與下一步

- 文件與程式：既有版本已提交於 `bb1c675`；DEV-018 已完成 Firebase 代管式架構，DEV-012 正在加入公開連結匿名 session。
- 本地工程：預設 local-file adapter，不需要 SQL、Docker、Java 或雲端 credential；production 強制 Firebase Auth、Firestore 與 Storage。
- QA／QC：單元、memory／local-file 整合、三 viewport E2E 與 production build 為本地 gate；Firebase Emulator 因本機缺 Java 可標記未執行，詳見 QC-001。
- Git：repository 已初始化；目前分支含既有未提交產品修改，release 前需建立可追溯 commit boundary。
- 下一步：完成本機 release gate，建立獨立 Firebase project 與 App Hosting backend，啟用 Anonymous Auth 後執行 production smoke。
- 已排除既有 Firebase projects：`jenfu-ai-pdm-prod`、`jenfu-ai-pdm-stg-361825`、`projed-cc78d`、`projed-test` 均屬其他產品，不得作本系統部署目標。

## Blocker 與 Re-entry Trigger

目前沒有 P0／P1 defect。下列事項不阻擋本地工程交付，但在對應邊界前必須重新進入：

- DEV-011 真實案件平行試算：提供 3～5 個去識別案件、人工結果與可接受差異後恢復。
- 獨立 Firebase project、billing、Anonymous Auth 與 App Hosting：需由 release owner 確認建立新 project，不得沿用 PDM／ProJED。
- 報告編號：目前固定 `RDR-{ULID}`，本次同事試用不另設人工流水號。
- 法規或主管機關來源版本變更：啟用新 RuleSet，不回寫既有報告。

## 來源證據位置

- 交叉比對來源：`J:\共用雲端硬碟\99_總經理室Google雲端\法規標準\法規-產品\臺北市政府工務局衛生下水道工程處_油脂截留槽計算.pdf`
- 主要計算依據：`J:\共用雲端硬碟\99_總經理室Google雲端\法規標準\法規-產品\臺北市政府工務局衛生下水道工程處_油脂截留器使用維護及設計說明.pdf`
- 主要計算依據官方 PDF：`https://www.nlma.gov.tw/filesys/file/chinese/publication/law2/1090811791a.pdf`
- 舊版 v0.4 來源文件：`C:\Users\user\Documents\Codex\2026-07-13\new-chat-3\outputs\鉦富_油脂截留器雙軌計算系統_開發文件_v0.4.md`

公式、表格與雜湊值已收斂於 SPEC-001；不得在 UI、PDF 模板或測試中另抄一套公式。

## 文件更新責任

- 產品語意、狀態機、公開 API、資料模型或權限變更：先更新／新增 ADR，再同步 SPEC、QA 與 dev_task。
- 局部工程決策：更新對應 SPEC 與 dev_task，不需新增 ADR。
- RD／QA／QC 執行結果：更新 dev_task；正式證據量大時才新增 qc／report 文件。
- Release artifacts：只有使用者提出合併、PR、部署、上線或 release 後才建立。
