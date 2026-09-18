# ADR-011｜新增有效容積換算設計處理水量的單軌任務

狀態：Accepted / Implemented Locally

日期：2026-09-18

決策來源：使用者明確要求在建立案件頁加入「客戶詢問設備處理量如何計算」的情境。

## Context

既有 `T05_DESIGN_TO_DINERS_AND_AREA` 是用設備能力或有效容積反推等效人數與面積，不能回答「已知設備有效容積時，設計處理水量是多少」。臺北市工務局衛工處設計說明已有 `Veff=Qhour/6`，可在同一來源契約內反算 `Qhour=6×Veff`；內政部附錄 5 則沒有僅憑有效容積換算 Q 與 G 的公式。

## Options

- A：沿用 T05，只改建案選項文字。
- B：新增雙軌任務，讓兩份計算依據都從有效容積換算流量。
- C：新增只適用算法 A 的獨立任務，保留公式、單位與來源限制。

## Decision

採 C。

## Chosen rule

- 新增 `T06_EFFECTIVE_VOLUME_TO_FLOW`：「我知道設備有效容積，要換算設計處理水量。」
- 此任務只允許 `LEGACY_QV`；建立案件時只顯示算法 A，schema 與 Firestore Rules 同步拒絕其他模式。
- 輸入為設備有效容積 `Veff`（L）與資料來源／證據。
- 計算為 `Qhour=6×Veff`（L/h），結果頁統一換算為 L/min 顯示。
- 不以設備外殼名目容積代替有效容積，不宣稱容積單獨可算出算法 B 的 Q/G 能力。
- 原 T01～T05 的雙軌契約維持不變。

## Consequences

- 建案任務由五個增加為六個；第六個是明確的單軌例外。
- UI、domain calculator、schema、Firestore Rules、報告與測試必須使用同一穩定任務代碼。
- T06 報告保留有效容積輸入、資料來源、L/h 原始計算與 L/min 單位換算。

## Amends

本 ADR 修訂 ADR-001 的「所有任務皆雙軌」範圍：該規則仍適用原 T01～T05；T06 依來源公式限制為 `LEGACY_QV`。
