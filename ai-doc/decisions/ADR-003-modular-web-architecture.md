# ADR-003｜採 provider-neutral 模組化 Web 單體

狀態：Accepted for Phase 1  
日期：2026-07-13  
決策類型：AI engineering decision；不改變使用者產品語意

## Context

專案目錄目前為空，尚無既有框架、資料庫或託管 provider。系統同時需要高精度計算、規則版本、案件工作流、audit 與 PDF；過早拆成微服務會增加交易與部署成本，使用 vendor-specific backend 又會在尚未確認正式環境前鎖定 provider。

## Options

- A：Excel／單機 script 為核心。
- B：TypeScript 模組化 Web 單體、PostgreSQL、ports/adapters。
- C：計算、案件、報告各自獨立微服務。
- D：直接綁定特定 managed backend／hosting provider。

## Decision

採 B。

## Chosen rule

- 使用 TypeScript end-to-end；framework 需支援 React UI 與 server application。
- 使用 PostgreSQL 保存關聯、版本、交易與 audit。
- calculator 是無 I/O pure function，使用 decimal 型別。
- case、rule、current calculator、legacy calculator、orchestration、review、report 分模組。
- ORM、Auth、PDF、storage、clock、ID generator 置於 adapter boundary。
- 本地可使用 seed identity；End-State 為雲端內部使用，正式 identity provider 與 hosting 延後至 release gate。
- PDF 只讀 ReportSnapshot，不從 live tables 重算。
- 版本以 lockfile 固定，不在規格中宣稱「最新版」。

## Consequences

- 第一階段可在同一 transaction 中維持雙軌與快照一致性。
- 後續可依實際負載抽離 PDF 或計算服務，但目前不承擔分散式交易成本。
- RD 必須維持 domain 與 framework 分離，不能把公式寫入 route、component 或 template。
- production provider 尚未選定，不阻擋本地 RD。

## Compatibility / migration

目前無程式與資料，無 migration。若未來改用等價 framework，只要資料、API、交易、權限與測試契約不變，不需新 ADR；改成微服務、vendor-specific schema／auth 或改變 module ownership 時必須建立後繼 ADR。
