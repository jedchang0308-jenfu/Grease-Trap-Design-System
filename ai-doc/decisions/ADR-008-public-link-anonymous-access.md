# ADR-008｜公開連結匿名存取（由 ADR-009 收斂）

狀態：Partially superseded by ADR-009

日期：2026-07-17

公開連結、無帳密登入、無角色及 Anonymous Auth 的產品決策仍有效。原先的 server session 實作已取消；現行由瀏覽器直接以 Firebase Anonymous Auth 登入，再依 Firestore Rules 存取共享案件。

匿名 identity 不代表公司身分。任何取得網址的人都可能讀寫或刪除共享案件。完整架構、安全與報告取捨以 ADR-009 為準。
