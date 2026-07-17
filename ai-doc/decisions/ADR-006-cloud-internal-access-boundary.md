# ADR-006｜第一版採雲端內部存取邊界

狀態：Superseded by ADR-008
日期：2026-07-13  
決策來源：HCS-3B

## Context

使用者選擇讓內部人員可從公司外透過網路登入，而不是限定公司內網或單一電腦。這會影響身份、session、API exposure 與 release gate，但不代表本輪已指定託管 provider 或要求部署。

## Options

- A：公司內網多人使用。
- B：雲端網路系統，授權內部使用者可從公司外登入。
- C：單一電腦本機使用。

## Decision

採 B。

## Chosen rule

- End-State 是公開網路可達、僅供已授權內部帳號使用的 Web 系統。
- 匿名使用者不得讀取案件、規則、報告或 API。
- 所有業務權限都由 server-side authorization 驗證；UI 隱藏不構成權限控制。
- 身份、session、TLS、備份、監控與 provider-specific 控制須在正式 release gate 驗證。
- 本地 RD 仍使用 provider-neutral AuthPort 與 seed identity，不得因目標為雲端就提前綁定供應商。

## Consequences

- 資料與 API 契約從第一天保留 identity subject、actor 與 audit。
- QA 必須包含匿名、過期 session、角色不足與跨案件存取的 negative tests。
- 本次只建立開發契約；部署計畫、rollback、production smoke 與正式 provider 選擇仍延後至 DEV-012。

## Compatibility impact

本 ADR 補充 ADR-003 的 End-State，取代 project_overview v1.0 對第一版運行環境未定的敘述，但不改變 provider-neutral 模組化單體決策。

2026-07-17 使用者改採公開連結匿名存取；第一版存取邊界與 Auth onboarding 改以 ADR-008 為準。本文件保留原始決策歷程，不再作為 active access contract。
