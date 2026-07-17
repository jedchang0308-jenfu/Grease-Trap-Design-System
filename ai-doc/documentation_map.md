# 文件地圖｜油脂截留器雙軌計算系統

文件狀態：`Static Spark Local Acceptance Passed`

權威版本：`3.1`

最後更新：`2026-07-17`

## 冷啟動順序

1. [project_overview.md](project_overview.md)：產品、架構與風險。
2. [dev_task.md](dev_task.md)：目前工作、驗證與 re-entry。
3. [ADR-009](decisions/ADR-009-static-firebase-spark-spa.md)：Spark 純靜態決策。
4. [SPEC-001](specs/SPEC-001-functional-engineering.md)：功能、資料、交易與報告契約。
5. [SPEC-002](specs/SPEC-002-ui-ux.md)：route、畫面、狀態與 responsive 契約。
6. [QA-001](qa/QA-001-validation-plan.md) 與 [QC-001](qa/QC-001-local-acceptance.md)：計畫與事實證據。

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

## 權威順序

1. 最新使用者明確決策。
2. ADR-009。
3. ADR-001、ADR-002、ADR-004 未被取代的產品規則。
4. SPEC-001、SPEC-002。
5. QA-001、QC-001。
6. 歷史 ADR 與 git baseline 只作追溯。

## 目前狀態

- 基線 commit：`c5af308 chore: checkpoint public Firebase workflow`。
- DEV-021：純靜態 Spark 重構、本機 integration、production static build、三 viewport E2E 與 QC 已完成。
- 本輪不建立 Firebase project、不啟用計費、不部署。
- Java 是 Firestore Emulator integration／E2E 的本機前置需求，不影響 production static build。

## Re-entry

- Firebase production：建立新 project、啟用 Anonymous Auth、建立 Firestore、設定 Web config、部署 Rules 與 Hosting 後執行 smoke。
- 真實案件：提供 3～5 個去識別案例與人工預期值。
- 正式核發或敏感資料：新 ADR、可信任後端、身分與留存政策。
