# ADR-005｜同一使用者可完成一人作業與直接核發

狀態：Accepted  
日期：2026-07-13；2026-07-17 updated
決策來源：HCS-2C；使用者 2026-07-17 要求「送審, 覆核等機制, 都先拿掉, 讓系統輕量化到一人作業模式」

## Context

第一版需要讓單一內部使用者完整處理案件。原決策只是不強制不同帳號覆核；最新決策進一步移除送審、覆核、退回與最終審核工作台，讓有效計算可直接進入報告預覽與核發。

## Options

- A：所有正式報告強制不同人覆核。
- B：允許同一使用者自行覆核與核發，但保留獨立覆核工作流。
- C：移除獨立覆核工作流，採一人作業；計算成立後直接預覽並核發。

## Decision

採 C。此決策是對 2026-07-13「單人可覆核」的 intentional replacement。

## Chosen rule

- 同一帳號可依序建立、計算、預覽報告、核發與建立修訂版。
- 計算狀態為 `COMPLETE` 或 `COMPLETE_WITH_REMINDER`，且案件尚未核發／取代時，可以直接預覽並核發。
- 不保留送審、最終審核、覆核 checklist、退回原因或 reviewedBy 欄位。
- snapshot 至少保存 preparedBy 與 issuedBy；兩者可以相同。
- 不實作 separation-of-duty 阻擋或切換帳號要求。
- 規則管理等管理權限仍採 server-side authorization；同一帳號可被授予多個 capability。

## Consequences

- 工作流不需要等待另一位使用者，也不需要進入中間送審狀態。
- UI 主路徑從 `CALCULATED` 直接到 `預覽並核發報告`。
- 歷史資料若仍有 `IN_REVIEW` 或 `REVIEWED`，UI 與 service 應以可核發狀態相容處理，不重新暴露覆核功能。
- audit／資料追溯聚焦於計算輸入、規則版本、報告快照與核發 actor。

## Compatibility impact

這是對 SPEC-001 v1.0 權限矩陣、SPEC-002 v1.0 多角色流程及原 separation-of-duty deferred decision 的 Intentional replacement。
