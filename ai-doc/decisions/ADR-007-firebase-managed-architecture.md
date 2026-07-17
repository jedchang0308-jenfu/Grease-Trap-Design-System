# ADR-007｜Firebase 全端代管架構（歷史決策）

狀態：Superseded by ADR-009

日期：2026-07-17

此決策曾選擇 Firebase 全端代管與 server-side 信任邊界。使用者後續明確採用 Spark 純靜態 SPA，故該方案未部署且不再是工程契約。

現行架構不使用 Firebase App Hosting、Admin SDK、Cloud Storage、server session 或 server-side PDF；完整取代原因與取捨見 ADR-009。
