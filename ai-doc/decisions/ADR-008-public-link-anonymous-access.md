# ADR-008｜第一版採公開連結匿名存取

狀態：Accepted / Implemented Locally
日期：2026-07-17
決策來源：使用者要求第一版不設定角色，任何取得網址的人都可以使用

## Context

原先 ADR-006 將雲端 End-State 限定為已授權內部帳號，但目前同事試用的優先目標是降低進入門檻，不先維護帳號與角色。系統仍需要 server-side 身份 subject，供 session、actor 與既有 API 契約使用。

## Options

- A：Email／Password 或 Google 登入，並設定 custom role claims。
- B：Firebase Anonymous Auth 自動建立暫時身份，使用者開啟網址後直接進入。
- C：完全移除身份與 session，讓 API 接受未驗證請求。

## Decision

採 B。第一版不要求登入畫面、帳號建立或角色配置；任何取得網址的人都能由瀏覽器自動建立 Firebase anonymous identity 與 server session，並使用目前所有產品功能。

不採 C，因為 server session 可保留 actor、撤銷與未來收斂存取範圍的能力，也避免把所有業務 API 改成無身份端點。

## Chosen rule

- App Hosting 首次載入先檢查 server session；沒有有效 session 時自動執行 Firebase Anonymous Auth 並交換 `httpOnly` session cookie。
- 有效 Firebase 身份不需要 custom role claims；server 在第一版公開模式授予現有應用能力。
- Firestore 與 Storage client rules 維持 deny all；所有資料存取仍只經 Next.js server 與 Admin SDK。
- 沒有有效 Firebase token／session 的直接 API 請求仍回 401；瀏覽器入口會自動建立所需 session。
- 知道網址的人可讀取、建立、修改、刪除、計算與核發共享案件。第一版不承諾使用者隔離、資料隱私或角色分權。
- Firebase Console 必須啟用 Anonymous provider；不建立 Email／Password 使用者或 custom role claims。

## Consequences

- 同事開啟網址即可使用，不需帳號支援流程。
- 網址外流即等同開放系統功能；案件內容不得放入不適合公開連結環境的敏感資料。
- anonymous identity 只用於技術 session 與 actor trace，不代表已驗證真實人員身份。
- 未來若要限制公司帳號、區分角色或處理敏感資料，需另立存取決策並重新驗證 Auth、API、資料與 UI。

## Compatibility impact

- 本 ADR 有意取代 ADR-006 的「僅限已授權內部帳號」與角色不足負向路徑。
- ADR-007 的 Firebase、server-side API、Firestore、Storage 與 App Hosting 架構維持不變；只替換 Auth onboarding 與 authorization policy。
- local 開發仍使用 seed identity，自動化測試仍可直接驗證未帶身份的 API 回 401。
