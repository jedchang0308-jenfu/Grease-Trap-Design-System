# ADR-005｜同一使用者可完成編製、覆核與核發

狀態：Accepted  
日期：2026-07-13  
決策來源：HCS-2C；使用者註解「覆核責任、正式核發條件，這個讓使用者一個人完成即可」

## Context

第一版需要讓單一內部使用者完整處理案件。若強制編製者與覆核者為不同帳號，會讓實際只有一位處理者的情境無法完成正式報告。

## Options

- A：所有正式報告強制不同人覆核。
- B：只有高風險案件強制不同人覆核。
- C：允許同一使用者自行覆核與核發，但保留完整紀錄。

## Decision

採 C。

## Chosen rule

- 同一帳號可依序建立、計算、提交覆核、完成覆核與核發。
- 覆核步驟、覆核 checklist、報告預覽與核發確認不得省略。
- preparedBy、reviewedBy、issuedBy 可以相同，仍分欄保存 actor、時間與決策內容。
- 不實作 separation-of-duty 阻擋或切換帳號要求。
- 規則管理等管理權限仍採 server-side authorization；同一帳號可被授予多個 capability。

## Consequences

- 工作流不需要等待另一位使用者，適合單人端到端操作。
- audit 必須能證明同一人何時完成各責任步驟，不能把三個動作合併成一次事件。
- UI 的 IN_REVIEW 狀態應提示目前使用者繼續覆核，不得顯示等待他人。

## Compatibility impact

這是對 SPEC-001 v1.0 權限矩陣、SPEC-002 v1.0 多角色流程及原 separation-of-duty deferred decision 的 Intentional replacement。
