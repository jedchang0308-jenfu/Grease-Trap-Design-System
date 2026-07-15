# QC-001｜本地 RD／QA／QC 驗收紀錄

文件狀態：`Conditional Pass — Human Pilot Pending`
版本：`1.1`
驗證日期：`2026-07-15`
適用範圍：`DEV-001～005、DEV-007～011、DEV-014` 的本地工程與自動化驗收；不含 `DEV-012` 正式發版

## 結論

8 個有效產品交付點已完成，本地 lint、型別、單元、資料庫整合、production build、跨視窗 E2E、PDF 產生與視覺檢查均通過，未發現 P0／P1 defect。

`DEV-011` 仍保留一項不可由 AI 假造的人工證據：使用者需提供 3～5 個已去識別實際案件與既有人工試算結果，才能完成真實案件平行差異比對。因此本文件不把 synthetic fixture 宣稱為真實案件；目前狀態為「本地工程關卡通過，Human Pilot Pending」。

## 2026-07-14｜DEV-013 增補驗證

- 結論：通過；基本資料可全空白建案，餐飲類型只在內政部給排水規範（附錄 5）計算資料出現且未預選。
- 自動證據：21 unit、lint、typecheck、format、production build、三 viewport 9 E2E 全部通過。
- 手動流程：驗證 Step 3 無餐飲類型、五個基本資料皆標示選填、返回後資料保留、空白案件使用案件編號及「未填」替代文字、未選餐飲類型不可送出計算。
- UI 證據：1440×900 與 390×844 截圖無重疊、裁切或水平溢出，browser console 0 errors。
- 註記：build 與 E2E 首次並行執行時 Windows build worker 發生資源競爭；改為依序執行後兩者均通過，未列為產品缺陷。

## 2026-07-15｜DEV-014 報告順序調整驗證

- 結論：通過；編製者可在 `CALCULATED` 先完成完整報告草稿與人工採用，送出後才進入 `IN_REVIEW`，審核者只針對完整送審報告完成一次工程覆核，核准後才可核發。
- 自動證據：21 unit、9 integration、lint、typecheck、format、production build、三 viewport 12 E2E 全部通過。
- 狀態證據：未覆核草稿可預覽但不可核發；`IN_REVIEW` 的人工採用面板為唯讀；`REVIEWED` 才顯示核發；`ISSUED` 保留不可變快照與下載入口。
- UI 證據：1440×900、1024×768、390×844 均完成「報告草稿 → 最終工程覆核 → 報告預覽 → 核發」流程，visible error、未預期 API 失敗、console error 與水平溢位 sweep 通過。

## 可重跑證據

| 門檻          | 指令／證據                                                  | 結果                                                             |
| ------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| 程式品質      | `npm run lint`、`npm run typecheck`、`npm run format:check` | 通過，0 warning／error                                           |
| 單元測試      | `npm test`                                                  | 5 files，21 tests passed                                         |
| DB 與服務整合 | `npm run test:integration`                                  | 1 file，9 tests passed                                           |
| 正式建置      | `npm run build`                                             | Next.js production build 通過，全部 routes 編譯成功              |
| 瀏覽器流程    | `npm run test:e2e`                                          | 1440、1024、390 三種 viewport；12 tests passed                   |
| 依賴弱點      | `npm audit`                                                 | 0 vulnerabilities                                                |
| DB seed       | `npm run db:verify`                                         | A-34 50、A-35 10、A-36 171、A-37 55、LEGACY-K 5、LEGACY-WATER 20 |

## 計算與資料事實驗證

- 內政部給排水規範（附錄 5）：官方人數與學校案例、A-36 的 610 m² 來源例外、相鄰數值內插、反推嚴格比較均有單元測試。
- 臺北市工務局衛工處設計說明：用餐人數、學校漏零修正、實測、面積與反推向下取整均有單元測試；B／C 類未提供 exact k 時拒絕猜值。
- 雙軌：任一有效軌可形成 `COMPLETE_WITH_REMINDER`；未完成軌不建立假 run／result；零有效軌才阻擋。
- 一致性：計算請求具 idempotency 與 optimistic version；ACTIVE RuleSet、COMPLETED run、ISSUED snapshot／case 均由資料庫約束保護。
- 責任鏈：同一 seed actor 可完成編製、提交、覆核與核發，但 audit 事件、時間、checklist 與責任欄位分開保存。

## UI／UX 與負向路徑

- 三種 viewport 均完整操作「案件清單 → 三步任務精靈 → 雙軌工作台 → 報告草稿 → 最終工程覆核 → 報告預覽 → 不可逆核發確認 → 已核發下載 → 規則來源」。
- 自動 sweep 驗證無 visible runtime error、未預期 4xx／5xx API、未預期 console error 與 document 水平溢位。
- 未登入 API 回傳安全的 `application/problem+json`；未登入 UI 顯示人類可理解訊息、重試／安全返回與 correlation ID，不揭露 SQL 或內部 schema。
- 工程覆核預設顯示採用值、中文名稱與單位；高精度 raw 值收在可展開稽核明細。
- 證據位置：`output/playwright/evidence/{desktop-1440,tablet-1024,mobile-390}`。

## PDF 驗證

| 樣本                                                  | 頁數 | 尺寸 | 結果 |
| ----------------------------------------------------- | ---: | ---- | ---- |
| `output/pdf/grease-trap-current-sample.pdf`           |    5 | A4   | 通過 |
| `output/pdf/grease-trap-legacy-sample.pdf`            |    5 | A4   | 通過 |
| `output/pdf/grease-trap-dual-sample.pdf`              |    6 | A4   | 通過 |
| `output/pdf/grease-trap-dual-single-track-sample.pdf` |    6 | A4   | 通過 |

四份 PDF 共 22 頁均以 Poppler 渲染為 PNG 並逐頁／代表頁人工視覺檢查：繁體中文可讀、頁碼正常，無黑方塊、裁切、重疊或缺頁；雙軌單軌完成樣本明確標示未完成軌且沒有假值。HTML content regression 另驗證不含產品／證書匹配結論。

瀏覽器的 full-page screenshot 對當下 viewport 外的 sandboxed `srcDoc` iframe 偶爾只截到白框，這是 Chromium 截圖限制，不作 PDF 通過證據。E2E 會直接進入 iframe 驗證報告標題；最終版面證據以實體 PDF 的 22 頁渲染結果為準。

## 關卡判定

| Gate                    | 判定          | 說明                                                                              |
| ----------------------- | ------------- | --------------------------------------------------------------------------------- |
| G1 Foundation           | Pass          | 固定本地入口、Git、PostgreSQL、migration／seed／checksum、auth port 均完成        |
| G2 Calculation          | Pass          | 兩份計算依據、對照與邊界測試通過                                                  |
| G3 Workflow             | Pass          | 案件、覆核、override、revision、snapshot、PDF 與 RWD 完成                         |
| G4 Automated Acceptance | Pass          | 自動化、UI QC、PDF QC 無 P0／P1 defect                                            |
| G4 Human Parallel Pilot | Pending Human | 尚未收到 3～5 個去識別實際案件與人工預期值                                        |
| Release                 | Not Run       | `DEV-012` 未獲 release 型指令，未選 provider／Auth、未部署、未做 production smoke |

## Human Re-entry 清單

1. 提供 3～5 個已去識別實際案件：輸入、採用參數、既有人工結果與可接受差異，供 `DEV-011` 平行試算簽核。
2. 首次 production release 前決定正式報告編號格式。
3. 提出 release 型指令後，才進入 `DEV-012` 選定雲端 provider、正式 Auth、成本、備份、rollback 與 production smoke。
