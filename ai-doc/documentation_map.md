# 文件地圖｜油脂截留器雙軌計算系統

文件狀態：`Static Spark Production Deployed；DEV-037 雙算法選值依據統一呈現已實作／本次 UI QC 待補；DEV-036 用餐區面積雙欄與選擇性同步已實作／本次 UI QC 待補；DEV-035 查表說明整合視窗已實作／本次 UI QC 待補；DEV-034 A／B 用水量表入口整合已實作／本次 UI QC 待補；DEV-033 雙算法比較介面本機 UI 驗證通過；DEV-031 本機埠衝突復原已驗證`

權威版本：`4.24`

最後更新：`2026-10-06`

## 冷啟動順序

1. [project_overview.md](project_overview.md)：產品、架構與風險。
2. [dev_task.md](dev_task.md)：目前工作、驗證與 re-entry。

只在選定工作後載入對應文件：

- 繼續 DEV-029：依序讀 [ADR-012](decisions/ADR-012-immutable-case-revision-subcollection.md) → [SPEC-003](specs/SPEC-003-case-version-history.md) → [QA-002](qa/QA-002-case-version-history.md)。
- 其他 DEV：依 `dev_task.md` 的直接引用，從下方 Active 文件表載入最少必要 ADR／SPEC／QA／QC；不要一次讀完整套文件。

不得只憑聊天記憶或 README 開始後續修改。

## Active 文件

| 文件                                                                  | 地位             | 主要用途                   |
| --------------------------------------------------------------------- | ---------------- | -------------------------- |
| [project_overview.md](project_overview.md)                            | End-State 權威   | 架構、scope、風險          |
| [dev_task.md](dev_task.md)                                            | 唯一 DEV 入口    | 狀態、acceptance、re-entry |
| [ADR-012](decisions/ADR-012-immutable-case-revision-subcollection.md) | Active           | 歷史版本資料與交易架構     |
| [SPEC-003](specs/SPEC-003-case-version-history.md)                    | Feature Contract | 歷史版本產品與技術邊界     |
| [SPEC-001](specs/SPEC-001-functional-engineering.md)                  | 功能工程權威     | 公式、資料、交易、報告     |
| [SPEC-002](specs/SPEC-002-ui-ux.md)                                   | UI／UX 權威      | route、CTA、RWD、錯誤      |
| [ADR-001](decisions/ADR-001-dual-track-first-class.md)                | Active           | 雙軌隔離                   |
| [ADR-002](decisions/ADR-002-one-valid-track-release.md)               | Active / updated | 任一有效軌可產生草稿       |
| [ADR-004](decisions/ADR-004-exclude-product-certificate-matching.md)  | Active           | 排除產品／證書匹配         |
| [ADR-009](decisions/ADR-009-static-firebase-spark-spa.md)             | Active           | Spark 靜態 Firebase 架構   |
| [ADR-010](decisions/ADR-010-direct-formal-report-output.md)           | Active           | 無核發流程的正式報告輸出   |
| [ADR-011](decisions/ADR-011-effective-volume-to-flow-task.md)         | Active           | T06 單軌任務與公式邊界     |
| [QA-001](qa/QA-001-validation-plan.md)                                | Active           | 驗證計畫                   |
| [QA-002](qa/QA-002-case-version-history.md)                           | Local Verified   | DEV-029 驗證契約與本機證據 |
| [QC-001](qa/QC-001-local-acceptance.md)                               | Active           | 本輪事實驗證               |

ADR-003、ADR-005、ADR-006、ADR-007 是歷史決策；ADR-008 的公開匿名產品決策仍有效，但技術實作以 ADR-009 為準。

## 最新 Human Decisions

| ID    | 決策                                                   |
| ----- | ------------------------------------------------------ |
| HD-01 | 兩份算法依據與五大任務都在第一階段，計算路徑隔離。     |
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
| HD-15 | 新增有效容積換算處理水量情境，僅使用算法 A。           |
| HD-16 | 未來建立新版本時須保留舊版，並提供歷史版本唯讀查看。   |
| HD-17 | 刪除案件時永久刪除目前版本與全部歷史版本，不改成封存。 |
| HD-18 | 歷史版本可用目前版型重新輸出 PDF，且須標示重新產生。   |
| HD-19 | 報告與系統文案統一使用「算法依據」稱呼來源文件與算法 A／B。 |
| HD-20 | 比較列說明用餐區面積可選同步；其他欄位仍各自輸入，不新增同步或換算行為，差異解釋放在欄位問號說明內。 |
| HD-21 | 用餐區面積改為算法 A、B 兩欄並預設勾選同步；可取消同步獨立編輯。此決策僅適用用餐區面積，不改變其他欄位的獨立輸入行為。 |
| HD-22 | 雙算法選值依據在同一展開區以 A／B 並列、相同欄位順序呈現；兩側選值理由與補充資料選填，算法 A 資料來源類型仍必填，算法 B 來源表及覆寫狀態由系統帶入。 |

## 權威順序

1. 最新使用者明確決策。
2. ADR-012 與 SPEC-003（僅 DEV-029 歷史版本範圍）。
3. ADR-011。
4. ADR-010。
5. ADR-009 未被 ADR-010／ADR-012 取代的技術規則。
6. ADR-001、ADR-002、ADR-004 未被取代的產品規則。
7. SPEC-001、SPEC-002。
8. QA-002（DEV-029）與 QA-001、QC-001（既有基線）。
9. 歷史 ADR 與 git baseline 只作追溯。

## 目前狀態

- DEV-037：算法 A、B 的本案計算方法、資料來源、採用參數、選值理由與補充資料在同一展開區按相同順序並列呈現；區內理由及補充資料選填，A 資料來源類型仍必填。理由留白不新增表單必填限制或缺少理由警示，既有工程輸入驗證不變；已填的理由與證據保存於輸入摘要並呈現在報告。本次工作台 UI QC 待補。
- DEV-036：用餐區面積在算法 A、B 各有可編輯欄位，預設勾選同步並可取消；已保存的不同值會保留並以未勾選呈現。面積換算列以同行細項標籤標明算法 A 人員密度／翻桌率，並顯示算法 B 帶入的 n、n₀ 值；其他欄位維持獨立輸入，差異與查表說明保留在問號內，不另顯示關係標籤或欄位下方提示；本次 UI QC 待補。
- DEV-035：算法 A q、密度／翻桌率及 k，算法 B Wm′／Wm、k 與每日 t 的查表內容已整合至對應問號彈窗；算法 A 安全係數類別與 exact k 說明均可查看 A／B／C 餐飲形式，類別彈窗已刪除重複補充段落；用水量與每日 t 的人數法／面積法均標示本案採用方法。查表問號實心深色、純說明問號淡色外框，尺寸與位置一致。當前工作區 typecheck 通過，工作台 UI QC 待補。
- DEV-034：算法 A 臺北市 q 範圍表與算法 B 固定雙欄 Wm′（人數法）／Wm（面積法）參考表由「用水量參數」列問號開啟，並標示本案採用方法；比較表主欄仍只顯示當前任務適用值。本次入口整合尚待桌機與 390px UI QC。
- DEV-032：算法 B t 欄位依任務與餐飲類型預填適用查表值，使用者可編輯；查表值不保存為覆寫；實作已完成，UI 尚待驗證。
- DEV-033：雙算法工作台以共同比較表按列呈現對應欄位；明確保留算法差異與單位；T01／T03／T05 桌機與 T01 390px 手機版 UI 驗證通過。
- DEV-031：本機 `dev:local` 可重用同專案 Firebase Emulator；預設 Emulator 埠被占用時選取可用替代埠並同步 Vite 設定。既有 Windows PowerShell 5.1 重用 smoke 與本次 PowerShell 7.6.5 啟動／重用 smoke 通過；未知 Vite port owner 只回報 PID／程序名稱，不自動終止。runtime 按使用者要求維持運作，尚未做停止／埠釋放 smoke；未跑測試套件。
- DEV-029：已完成本機實作與驗證；資料路徑、atomic transaction、`DELETING` recovery、routes、歷史報告 provenance 已落地。commit `2e1d261` 已發布 Rules／Hosting；canonical static smoke、asset provenance、production Auth／Firestore read-only smoke 與一次性授權 production history feature smoke 通過（版本 2 建立、歷史清單／唯讀明細／精簡與完整歷史報告、整案刪除後 direct URL 拒絕）。測試 fixture 已清理，未留下正式資料。
- 基線 commit：`c5af308 chore: checkpoint public Firebase workflow`；release commit：`f0ccc1c refactor: ship static Firebase Spark SPA`。
- DEV-021：純靜態 Spark 重構、本機 integration、production static build、三 viewport E2E 與 QC 已完成。
- DEV-023：有效容積換算設計處理水量情境已完成本機驗證與 production smoke。
- DEV-012：已部署至 `https://jenfu-grease-trap-calculator.web.app`，production smoke 已通過。
- 本輪未建立 Firebase project、未啟用計費；`69b25ba`、`b27933e` 與 `313e83e` 已部署至獨立 Spark project，Hosting smoke 通過。
- Java 是 Firestore Emulator integration／E2E 的本機前置需求，不影響 production static build。

## Re-entry

- DEV-029：本機實作與驗證已完成；若進入正式發布，必須依 release gate 一次部署 archive schema、Rules、routes 與 `DELETING` lifecycle，禁止部分發布。
- Firebase production：既有獨立 Spark project 已完成本輪 Rules/Hosting 發布；後續變更需重跑受影響 smoke 並保留 rollback 參考。commit `2e1d261` 的靜態資產已與 production hash 對應，Auth／Firestore read-only 與一次性 production archive branch 均已由 CLI browser 驗證；正式資料清理證據已保留於 QA-002。
- 真實案件：提供 3～5 個去識別案例與人工預期值。
- 若要加入簽核、核發、不可變留存或敏感資料：新 ADR、可信任後端、身分與留存政策。
