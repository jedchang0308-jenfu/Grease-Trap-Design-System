# SPEC-001｜油脂截留器雙軌計算系統：功能與工程契約

文件狀態：`Implemented Locally`

版本：`2.0`

日期：`2026-07-17`

權威範圍：功能語意、公式邊界、資料、交易、Auth、報告草稿與驗收

## 1. 目標

任何取得網址的人可由瀏覽器自動匿名登入，使用共享案件完成建案、雙軌計算、修訂、報告草稿預覽與瀏覽器列印。此版本不提供公司身分驗證、角色或正式核發。

成功條件：

1. 五個任務在兩份計算依據都可獨立執行。
2. 每個結果保留輸入、單位、公式、參數、來源與規則版本。
3. 雙軌任一有效軌即可產生報告草稿，不足軌明確提醒。
4. 任意 case ID route 可直接開啟與重新整理。
5. 未匿名登入者不能讀寫 Firestore。
6. production output 只有 `dist/` 靜態檔。

## 2. Scope

In scope：

- 案件清單、建立、搜尋、刪除、工作台與修訂。
- `CURRENT_QG`、`LEGACY_QV`、`DUAL_COMPARISON`。
- 五個客戶任務、正向／反向計算、完整性 assessment。
- 版本化 rules catalog、來源 metadata 與 checksum。
- 報告草稿 snapshot、HTML 預覽、隨站 Noto Sans TC、A4 print CSS、瀏覽器列印。
- Anonymous Auth、Firestore Web SDK、transaction 與 Rules。
- Firebase Spark 傳統 Hosting。

Out of scope：

- Email／Password、Google 登入、公司身分與角色 UI。
- 產品型號、證書、現場施工或法規核准判定。
- server runtime、business API、Admin SDK 或 service account。
- Cloud Storage、PDF 上傳／保存、正式簽核及不可變核發。
- 舊正式資料搬移。

## 3. 穩定代碼

任務：

| Code                            | 目的                   |
| ------------------------------- | ---------------------- |
| `T01_DINERS_TO_FLOW`            | 人數換算流量           |
| `T02_DINERS_TO_DESIGN`          | 人數換算設計需求       |
| `T03_AREA_TO_FLOW`              | 面積換算流量           |
| `T04_AREA_TO_DESIGN`            | 面積換算設計需求       |
| `T05_DESIGN_TO_DINERS_AND_AREA` | 輸入能力反推人數／面積 |

模式：`CURRENT_QG`、`LEGACY_QV`、`DUAL_COMPARISON`。兩軌不得共用單位或建立第三套混合公式。

## 4. 計算契約

### 4.1 內政部給排水規範（附錄 5）

全面積法：

```text
A  = kitchenArea + diningArea
Q  = A * Wm * (n / n0) * (1 / t) * k
Gu = (1 / 1000) * A * gu * (n / n0) * iu
Gb = (1 / 1000) * A * gb * (n / n0) * ib
G  = Gu + Gb
```

人數法：

```text
Q  = N * Wm' * (1 / t) * k
Gu = (1 / 1000) * N * gu * iu
Gb = (1 / 1000) * N * gb * ib
G  = Gu + Gb
```

反推：

```text
N_by_Q = Qcapacity * t / (Wm' * k)
N_by_G = 1000 * Gcapacity / (gu * iu + gb * ib)
N_equivalent_max = floor(min(N_by_Q, N_by_G))
```

面積反推必須依 A-36 的連續有效節點分段求解，不跨空白節點；向下到 0.1 m² 後重驗 Q/G 嚴格限制。參數表與精確來源值以 `src/domain/rules/seed-data.ts`、catalog checksum 及 golden unit tests 為工程權威，不得在 UI 或報告模板另抄一份可執行公式。

### 4.2 臺北市工務局衛工處設計說明

```text
Qhour = (n * q / t) * k
VeffRequired = Qhour / 6

n(area) = area * dinerDensity * turnover

nEquivalentMax = (6 * effectiveVolumeL * t) / (q * k)
areaEquivalentMax = nEquivalentMax / (dinerDensity * turnover)
```

q 優先用實測值；無實測時必須在來源範圍內選 exact value 並保存理由，不得自動取平均。B／C 類安全係數必須明確選 exact k。

### 4.3 精度

- domain 使用 Decimal 字串運算，不使用 JavaScript `number` 作工程判定。
- `rawValue` 用於限制與比較；`sourceDisplayValue` 只作來源回歸；`adoptedValue` 用於報告顯示。
- 正向 Q/G/Veff 向上至 0.1；反推人數向下至整數；反推面積向下至 0.1 m² 後重驗。
- L/min 與 L/h 只能透過明示 conversion 轉換並保留 trace。

## 5. 完整性與狀態

每一要求軌產生 `TrackAssessment`：`CALCULATED`、`INSUFFICIENT_DATA`、`INVALID` 或 `ERROR`。只有成功軌建立 calculation run。

| 模式 | 有效軌 | CalculationStatus        | 可產生草稿     |
| ---- | -----: | ------------------------ | -------------- |
| 單軌 |      1 | `COMPLETE`               | 是             |
| 單軌 |      0 | `BLOCKED`                | 否             |
| 雙軌 |      2 | `COMPLETE`               | 是             |
| 雙軌 |      1 | `COMPLETE_WITH_REMINDER` | 是，揭露不足軌 |
| 雙軌 |      0 | `BLOCKED`                | 否             |

現行生命週期：

```text
DRAFT -> CALCULATED -> REPORT_DRAFT
REPORT_DRAFT -> new revision -> DRAFT
```

`ISSUED`、`SUPERSEDED`、`IN_REVIEW`、`REVIEWED` 只作舊資料相容。新程式不得建立新的正式核發狀態；舊 `ISSUED`／`SUPERSEDED` 為唯讀。

重新計算會清除既有 report draft。建立新修訂時 `revision_no + 1`、`version + 1`，清除 calculation、assessment、override 與 report draft，但保留案件 group、原建立者及原建立時間。

## 6. Firestore 資料

只有 `cases/{caseGroupId}` collection。每個共享案件使用單一 aggregate document；必要 top-level fields 採白名單：

- schema、record ID、case group ID、case no、revision、customer、location、title、purpose。
- dining type、task、mode、lifecycle、calculation status、version。
- created／prepared actor display、created／updated time。
- `inputPayloadJson`、`calculationsJson`、`assessmentsJson`、`overridesJson`、`reportDraftJson`。

複雜 payload 以 JSON string 保存，分別限制最大 60k、320k、60k、60k、360k；client decode 必須通過 strict Zod schema。未知 top-level 欄位拒絕。

## 7. Transaction 與併發

- create transaction 先確認 document 不存在，初始 `version=1`、`revisionNo=1`。
- 每次 mutate 在 transaction 內重新讀取 document，next version 必須恰為 current + 1。
- revision 只能維持原 revision 或 +1；不能跳號。
- stale version 顯示可重試錯誤，不得靜默覆蓋另一匿名 session 的更新。
- report draft snapshot 只能由當前 calculation runs 建立，不在 print 階段重算。

## 8. Authentication 與 Rules

- App 啟動呼叫 `signInAnonymously`，使用 browser local persistence。
- Auth ready 前只顯示匿名連線 gate，不 render 案件 routes 內容。
- `request.auth == null`：所有 read/write 拒絕。
- `request.auth != null`：可讀寫共享 `cases`，仍需通過 schema、型別、長度、列舉與 version Rules。
- 未宣告 collection 一律拒絕；不得有 `allow read, write: if true`。
- Anonymous Auth 不表示真實姓名、公司員工或授權角色。

UI 對 anonymous sign-in、permission denied、quota、network unavailable、timeout 與 stale version 提供明確錯誤及可重試狀態。

## 9. Report Draft

snapshot schema `2.0` 至少包含 case、input、calculation runs、assessments、rules、preparedBy、exportedBy、snapshot hash、限制與產生時間。

- CTA 使用「預覽報告草稿」「匯出報告草稿」「列印／另存 PDF」。
- 匯出只把 snapshot 保存到 case document，不建立 PDF blob 或獨立 report collection。
- HTML 使用 A4 print CSS、重複表頭、孤行與斷頁控制；報告字型使用 build-time 靜態輸出的 Noto Sans TC。
- report iframe 完成載入後，必須等待 `document.fonts.ready`、指定字型檢查、圖片載入／解碼及兩個 render frame，才可呼叫 `window.print()`。
- 顯示「不是正式簽核／核發」，並說明已降低字型差異但紙張、縮放與列印引擎仍可能造成細微差異。
- 舊 `ISSUED` snapshot 可唯讀預覽與列印，不能重新匯出成新的正式紀錄。

## 10. SPA 與 Hosting

Routes：`/cases`、`/cases/new`、`/cases/:id`、`/cases/:id/report`、`/rules`。

- React Router 使用 `BrowserRouter`。
- `firebase.json` public 為 `dist`，`**` rewrite `/index.html`。
- build-time config 只允許公開 `VITE_FIREBASE_*`；不得包含 private key 或 service account。
- production source 與 bundle 不得包含 server handler、Node-only runtime、Admin SDK 或 PDF renderer。

## 11. Definition of Done

- format、lint、typecheck、unit、Rules/repository integration、static build、E2E 皆通過。
- Rules 負向驗證未登入、未知欄位、超長字串、跳版與未知 collection。
- 不同匿名 session 可讀寫同一案件。
- 1440、1024、390 無水平 overflow、元件重疊或 critical console error。
- 建案、編輯、雙軌計算、草稿預覽、匯出、列印入口、修訂皆可操作。
- `dist/report-fonts` 含 Noto Sans TC CSS、WOFF2 與 OFL 授權；列印時能確認指定字型及圖片已完成載入。
- 任意 dynamic route 直接開啟與 reload 正常。
- `dist/` 不含 server bundle；`git diff --check` 通過。
