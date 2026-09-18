# 文件地圖｜油脂截留器雙軌計算系統

文件狀態：`Static Spark Production Deployed`

權威版本：`3.4`

最後更新：`2026-09-18`

## 冷啟動順序

1. [project_overview.md](project_overview.md)：產品、架構與風險。
2. [dev_task.md](dev_task.md)：目前工作、驗證與 re-entry。
3. [ADR-011](decisions/ADR-011-effective-volume-to-flow-task.md)：有效容積換算處理水量的算法 A 單軌任務。
4. [ADR-010](decisions/ADR-010-direct-formal-report-output.md)：直接產出正式報告、不建立核發流程。
5. [ADR-009](decisions/ADR-009-static-firebase-spark-spa.md)：Spark 純靜態決策。
6. [SPEC-001](specs/SPEC-001-functional-engineering.md)：功能、資料、交易與報告契約。
7. [SPEC-002](specs/SPEC-002-ui-ux.md)：route、畫面、狀態與 responsive 契約。
8. [QA-001](qa/QA-001-validation-plan.md) 與 [QC-001](qa/QC-001-local-acceptance.md)：計畫與事實證據。

不得只憑聊天記憶或 README 開始後續修改。

## Active 文件

| 文件                                                                 | 地位             | 主要用途                   |
| -------------------------------------------------------------------- | ---------------- | -------------------------- |
| [project_overview.md](project_overview.md)                           | End-State 權威   | 架構、scope、風險          |
| [dev_task.md](dev_task.md)                                           | 唯一 DEV 入口    | 狀態、acceptance、re-entry |
| [SPEC-001](specs/SPEC-001-functional-engineering.md)                 | 功能工程權威     | 公式、資料、交易、報告     |
| [SPEC-002](specs/SPEC-002-ui-ux.md)                                  | UI／UX 權威      | route、CTA、RWD、錯誤      |
| [ADR-001](decisions/ADR-001-dual-track-first-class.md)               | Active           | 雙軌隔離                   |
| [ADR-002](decisions/ADR-002-one-valid-track-release.md)              | Active / updated | 任一有效軌可產生草稿       |
| [ADR-004](decisions/ADR-004-exclude-product-certificate-matching.md) | Active           | 排除產品／證書匹配         |
| [ADR-009](decisions/ADR-009-static-firebase-spark-spa.md)            | Active           | Spark 靜態 Firebase 架構   |
| [ADR-010](decisions/ADR-010-direct-formal-report-output.md)          | Active           | 無核發流程的正式報告輸出   |
| [ADR-011](decisions/ADR-011-effective-volume-to-flow-task.md)        | Active           | T06 單軌任務與公式邊界     |
| [QA-001](qa/QA-001-validation-plan.md)                               | Active           | 驗證計畫                   |
| [QC-001](qa/QC-001-local-acceptance.md)                              | Active           | 本輪事實驗證               |

ADR-003、ADR-005、ADR-006、ADR-007 是歷史決策；ADR-008 的公開匿名產品決策仍有效，但技術實作以 ADR-009 為準。

## 最新 Human Decisions

| ID    | 決策                                                   |
| ----- | ------------------------------------------------------ |
| HD-01 | 兩份計算依據與五大任務都在第一階段，計算路徑隔離。     |
| HD-02 | 雙軌任一有效軌即可產生報告草稿，不足軌只提醒。         |
| HD-03 | 不建立產品型號或證書匹配。                             |
| HD-04 | 任何取得網址的人都可使用，不設定公司帳號或角色。       |
| HD-05 | 使用 Firebase Anonymous Auth，所有匿名使用者共享案件。 |
| HD-06 | 採 Vite + React 純靜態 SPA 與 Firebase Spark Hosting。 |
| HD-07 | 不使用 server runtime、App Hosting、Storage 或 Blaze。 |
| HD-08 | 報告改為草稿 snapshot 與瀏覽器列印，不提供正式核發。   |
| HD-09 | 不搬移既有正式資料。                                   |
| HD-10 | 部署不得使用既有 PDM 或 ProJED Firebase project。      |
| HD-11 | 目標 project 為 `jenfu-grease-trap-calculator`。       |
| HD-12 | 所有人可直接產出正式報告，不建立核發機制。             |
| HD-13 | 原定 `RDR-YYMMDD-00` 報告編號，已由 HD-14 取代。       |
| HD-14 | 案件與正式報告共用 `GTC-YYMMDD-00`，不另建編碼邏輯。   |
| HD-15 | 新增有效容積換算處理水量情境，僅使用算法 A。          |

## 權威順序

1. 最新使用者明確決策。
2. ADR-011。
3. ADR-010。
4. ADR-009 未被 ADR-010 取代的技術規則。
5. ADR-001、ADR-002、ADR-004 未被取代的產品規則。
6. SPEC-001、SPEC-002。
7. QA-001、QC-001。
8. 歷史 ADR 與 git baseline 只作追溯。

## 目前狀態

- 基線 commit：`c5af308 chore: checkpoint public Firebase workflow`；release commit：`f0ccc1c refactor: ship static Firebase Spark SPA`。
- DEV-021：純靜態 Spark 重構、本機 integration、production static build、三 viewport E2E 與 QC 已完成。
- DEV-023：有效容積換算設計處理水量情境已完成本機驗證；不含部署。
- DEV-012：已部署至 `https://jenfu-grease-trap-calculator.web.app`，production smoke 已通過。
- 本輪不建立 Firebase project、不啟用計費、不部署。
- Java 是 Firestore Emulator integration／E2E 的本機前置需求，不影響 production static build。

## Re-entry

- Firebase production：建立新 project、啟用 Anonymous Auth、建立 Firestore、設定 Web config、部署 Rules 與 Hosting 後執行 smoke。
- 真實案件：提供 3～5 個去識別案例與人工預期值。
- 若要加入簽核、核發、不可變留存或敏感資料：新 ADR、可信任後端、身分與留存政策。
