# SPEC-001｜油脂截留器雙軌計算系統：功能與工程契約

文件狀態：`RD Implementation Ready`  
版本：`1.1`  
日期：`2026-07-13`  
權威範圍：功能語意、公式、參數、資料模型、API、狀態機、交易、報告與驗收

## 1. 目標與成功定義

本系統讓鉦富已授權的內部使用者依客戶不同的已知資料與目標，使用現行 Q/G 或舊版 Q/V 方法完成計算、覆核與設計計算書核發；同一位使用者可以完成整個責任流程。

成功必須同時滿足：

1. 五個客戶任務在兩軌都可獨立執行。
2. 每個結果可追到輸入、單位、公式、參數、來源頁與規則版本。
3. 雙軌只要一軌有效即可覆核與核發；不足軌只提醒。
4. 正向與反向計算共用相同 domain 規則，不建立平行公式。
5. 已核發報告可由不可變快照重現。
6. 系統只處理設計計算，不建立產品型號或證書匹配功能。

## 2. Scope

### 2.1 In scope

- 內部網頁系統與角色權限。
- 案件、客戶、場所、任務、計算模式、輸入、證據與假設。
- 現行 Q/G：人數法、全面積法、輸入 Q/G 設計能力反推。
- 舊版 Q/V：人數法、面積法、有效容積反推。
- 雙軌隔離執行與任一有效軌放行。
- 版本化法規來源、參數表、來源差異與規則快照。
- 工程覆核、退回、override、報告快照與 PDF。
- 雲端內部存取所需的 provider-neutral 身份與授權契約。
- audit 與第一階段自動化／人工驗收。

### 2.2 Out of scope

- 客戶帳號、客戶自行計算或線上簽核。
- 自動判定現場施工、安裝或維護已符合法規。
- 由設備名目容積推定現行 Q/G 設計能力。
- 把 CNS 計算無條件套用到 EN、ASME、SHASE 等國際標準產品。
- PDM／ERP 深度整合。
- 產品型號主檔、產品選型、額定能力查核、證書保存或符合性匹配。
- production deploy、merge、PR、rollback、production smoke 與 release report。

## 3. 穩定識別碼

### 3.1 任務代碼

```text
T01_DINERS_TO_FLOW
T02_DINERS_TO_DESIGN
T03_AREA_TO_FLOW
T04_AREA_TO_DESIGN
T05_DESIGN_TO_DINERS_AND_AREA
```

### 3.2 案件模式

```text
CURRENT_QG
LEGACY_QV
DUAL_COMPARISON
```

新案件預設 `CURRENT_QG`；系統不能因資料不足而靜默切換模式。

### 3.3 方法代碼

```text
CURRENT_BY_DINERS
CURRENT_BY_TOTAL_AREA
CURRENT_REVERSE_BY_CAPACITY
LEGACY_BY_DINERS
LEGACY_BY_AREA
LEGACY_REVERSE_BY_EFFECTIVE_VOLUME
DUAL_COMPARE_BY_DINERS
DUAL_COMPARE_BY_AREA
DUAL_COMPARE_REVERSE
```

任務代碼表示使用者目的，方法代碼表示 calculator 路徑；兩者不得合併。

## 4. 五大任務雙軌契約

| 任務 | 現行 Q/G 軌 | 舊版 Q/V 軌 |
|---|---|---|
| T01 人數→流量 | N、餐飲類型、Wm'、t、k → Q（L/min） | n、q、t、k → Q（L/h） |
| T02 人數→設計 | 現行設計需求 Q＋G | Q＋舊版有效容積需求 Veff |
| T03 面積→流量 | 廚房面積＋用餐區面積、餐飲類型、n、n0、t、k → Q（L/min） | 面積、密度、翻桌率、q、t、k → Q（L/h） |
| T04 面積→設計 | 現行設計需求 Q＋G | Q＋舊版有效容積需求 Veff |
| T05 設計→人數及面積 | 輸入 Q 能力＋G 能力＋相同假設 → 受控制條件限制的等效上限 | 有效容積＋q、t、k、密度、翻桌率 → 等效上限 |

固定用語：

- 現行 T02／T04：`現行設計需求 Q/G`，不得稱為法規需求公升數或已完成產品選型。
- 舊版 T02／T04：`舊版有效容積設計 Veff`。
- T05：`本組設計假設下的設備能力等效上限`，不得稱核准人數或合法面積。
- T05 使用的 Q/G 能力值是案件輸入與反推限制，不代表系統已驗證特定產品或證書。

## 5. 來源治理與差異

### 5.1 Source manifest

| 代碼 | 來源 | 地位 | SHA-256／查核 |
|---|---|---|---|
| SRC-CURRENT-2020 | 內政部《建築物給水排水設備設計技術規範》官方 PDF，附錄 5 | 現行 Q/G 規則來源 | `4B2112DBB61399F03BC928FCF85B5B0796A4939356848C2D12573344BFA418E0`，2026-07-13 下載查核 |
| SRC-LEGACY-CALC | 臺北市衛工處《油脂截留槽計算》5 頁摘錄 | 舊版 Q/V 交叉比對 | `5154E7B806F81EFEB855851CD3F280D4C80656A2AE62F7BAE2DD65B6453F98C5` |
| SRC-LEGACY-FULL | 臺北市衛工處《油脂截留器使用維護及設計說明》9 頁 | 舊版 Q/V 主要來源 | `33FBD41FBC2797C5F1EE1C2FB1C63F225DC07258EF9E30F0474C69C537CED4C8` |

現行官方 URL：`https://www.nlma.gov.tw/filesys/file/chinese/publication/law2/1090811791a.pdf`

每個 `SourceDocument` 必須保存檔名、機關、發布／修正日期、查核日期、URL／檔案位置、SHA-256、authority level 與狀態。

### 5.2 Source discrepancies

| 代碼 | 差異 | 系統處理 |
|---|---|---|
| DISC-LEG-001 | 舊版 q 在文字中曾標成 L/h，但公式代入是每人每餐用水量 | 正規化為 `L/(人·餐)`，保留原文差異 |
| DISC-LEG-002 | 計算摘錄學校案例中間式漏一個 0 | 依 n=500×3=1500 重算 Q=19500 L/h |
| DISC-LEG-003 | 計算摘錄面積案例顯示 `2000×1.5=300`，後續卻以 3000÷6 | 採數學正確值 3000 L/h；500 L 回歸測試 |
| DISC-LEG-004 | 便當中心用水範圍前後順序不一致 | 存為 min=25、max=100，不依顯示順序判斷 |
| DISC-LEG-005 | B、C 類安全係數各提供兩個可能值 | 必須由工程人員選 exact k 並寫理由，不自動猜值 |
| DISC-CUR-001 | 官方案例顯示值截斷至小數一位 | 保存 `sourceDisplayValue`，正式比較與反推使用重新運算 raw 值 |
| DISC-CUR-002 | A-36 中餐 400 m² 後空白，但 610 m² 官方案例使用 n0=3.4 | 只建立具來源的 610 m² 例外；不外推為通則 |

## 6. 單位與值物件

系統不得傳遞無單位裸數值。至少提供：

```text
LitersPerMinute
LitersPerHour
Liters
Kilograms
SquareMeters
MinutesPerDay
HoursPerMeal
PeoplePerDay
PeoplePerMeal
Days
DimensionlessRatio
```

L/min 與 L/h 只能透過明示的 unit conversion service 轉換，且轉換步驟必須進入計算軌跡。

## 7. 現行 Q/G 數學模型

### 7.1 全面積法

```text
A  = kitchenArea + diningArea                         [m²]
Q  = A × Wm × (n / n0) × (1 / t) × k                [L/min]
Gu = (1 / 1000) × A × gu × (n / n0) × iu            [kg]
Gb = (1 / 1000) × A × gb × (n / n0) × ib            [kg]
G  = Gu + Gb                                         [kg]
```

只提供用餐區面積不能執行現行面積法；廚房面積與用餐區面積必須分欄保存。

### 7.2 人數法

```text
Q  = N × Wm' × (1 / t) × k                           [L/min]
Gu = (1 / 1000) × N × gu × iu                        [kg]
Gb = (1 / 1000) × N × gb × ib                        [kg]
G  = Gu + Gb                                         [kg]
```

### 7.3 現行 A-34 全面積參數

`k=3.5`。`t` 單位為 min/day；Wm 為 L/(m²·day)；gu、gb 為 g/(m²·day)。

| 餐飲類型 | Wm | t | k | gu | gb |
|---|---:|---:|---:|---:|---:|
| 中餐 | 130 | 720 | 3.5 | 18.0 | 8.0 |
| 西餐 | 95 | 720 | 3.5 | 9.5 | 3.5 |
| 和食 | 100 | 720 | 3.5 | 7.0 | 2.5 |
| 拉麵 | 150 | 720 | 3.5 | 19.5 | 7.5 |
| 烏龍麵、蕎麥麵 | 150 | 720 | 3.5 | 9.0 | 3.0 |
| 簡餐 | 90 | 720 | 3.5 | 6.0 | 2.0 |
| 小吃、美食街 | 85 | 720 | 3.5 | 3.5 | 1.5 |
| 速食 | 20 | 720 | 3.5 | 3.0 | 1.0 |
| 工廠員工餐廳 | 90 | 600 | 3.5 | 6.5 | 3.0 |
| 學生餐廳 | 45 | 600 | 3.5 | 3.0 | 1.0 |

已知實際每日廚房使用時間時可取代 t 表值，但須保存輸入來源與證據；k 不開放案件輸入覆寫。

### 7.4 現行 A-35 餐位利用率 n

| 餐飲類型 | n |
|---|---:|
| 中餐 | 5.0 |
| 西餐 | 4.5 |
| 和食 | 5.0 |
| 拉麵、烏龍麵、蕎麥麵 | 5.0 |
| 簡餐 | 7.0 |
| 小吃、美食街 | 8.0 |
| 速食 | 8.0 |
| 工廠員工餐廳 | 4.0 |
| 學生餐廳 | 4.0 |

### 7.5 現行 A-36 補正餐位利用率 n0

`-` 表示來源無可用數值，不是 0。表中兩個相鄰有效節點之中間值可線性內插；不得跨過空白／`-` 內插。

| 類型＼A(m²) | 25 | 50 | 75 | 100 | 125 | 150 | 175 | 200 | 250 | 300 | 400 | 500 | 600 | 700 | 800 | 1000 | 1500 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 中餐 | - | - | 3.1 | 3.1 | 3.2 | 3.3 | 3.3 | 3.3 | 3.4 | 3.4 | 3.4 | - | - | - | - | - | - |
| 西餐 | - | - | - | 2.0 | 2.1 | 2.3 | 2.4 | 2.6 | 2.8 | 2.9 | 3.1 | 3.2 | 3.3 | 3.3 | 3.4 | - | - |
| 和食 | - | - | 2.1 | 2.3 | 2.5 | 2.6 | 2.7 | 2.8 | 2.9 | 3.0 | 3.2 | - | - | - | - | - | - |
| 拉麵、烏龍麵、蕎麥麵 | - | 3.1 | 3.9 | 4.5 | 4.9 | 5.2 | 5.5 | 5.7 | - | - | - | - | - | - | - | - | - |
| 簡餐 | 3.3 | 4.2 | 4.4 | 4.7 | 4.8 | 4.9 | 4.9 | 5.0 | 5.1 | - | - | - | - | - | - | - | - |
| 小吃、美食街 | 3.7 | 4.7 | 5.3 | 5.7 | 5.9 | 6.0 | 6.1 | 6.2 | - | - | - | - | - | - | - | - | - |
| 速食 | 3.3 | 4.2 | 4.4 | 4.7 | 4.8 | 4.9 | 4.9 | 5.0 | 5.1 | - | - | - | - | - | - | - | - |
| 工廠員工餐廳 | - | - | - | - | - | 2.4 | 2.6 | 2.8 | 3.0 | 3.3 | 3.6 | 3.8 | 3.9 | 4.1 | 4.2 | 4.3 | 4.5 |
| 學生餐廳 | - | - | - | - | - | 2.4 | 2.6 | 2.8 | 3.0 | 3.3 | 3.6 | 3.8 | 3.9 | 4.1 | 4.2 | 4.3 | 4.5 |

中餐 `A=610 m²` 依官方案例建立精確例外 `n0=3.4`，必須附 `SOURCE_EXCEPTION` 警示；不得把此例外推廣到其他 400 m² 以上面積。

### 7.6 現行 A-37 人數法參數

Wm' 為 L/person；t 為 min/day；gu、gb 為 g/person；k=3.5。

| 餐飲類型 | Wm' | t | k | gu | gb |
|---|---:|---:|---:|---:|---:|
| 中餐 | 80 | 720 | 3.5 | 11.0 | 5.0 |
| 西餐 | 80 | 720 | 3.5 | 8.0 | 3.0 |
| 和食 | 80 | 720 | 3.5 | 5.5 | 2.0 |
| 拉麵 | 50 | 720 | 3.5 | 6.5 | 2.5 |
| 烏龍麵、蕎麥麵 | 50 | 720 | 3.5 | 3.0 | 1.0 |
| 簡餐 | 45 | 720 | 3.5 | 3.0 | 1.0 |
| 小吃、美食街 | 25 | 720 | 3.5 | 1.0 | 0.5 |
| 速食 | 10 | 720 | 3.5 | 1.5 | 0.5 |
| 工廠員工餐廳 | 50 | 600 | 3.5 | 3.5 | 1.5 |
| 學生餐廳 | 25 | 600 | 3.5 | 1.5 | 0.5 |
| 學校午餐 | 15 | 480 | 3.5 | 0.7 | 0.3 |

### 7.7 複合式餐飲

系統對每個候選餐飲類型分別計算污水與油脂負荷，保存候選比較表，依規範採污水產生及油脂量最大者作估算基準。不得只留下最後類型或允許使用者無理由任選較小值。

## 8. 舊版 Q/V 數學模型

### 8.1 單餐期／連續操作人數法

```text
Qhour = (n × q / t) × k                              [L/h]
VeffRequired = Qhour / 6                             [L]
```

q 為 L/(person·meal)，t 為 hours，k 為舊版安全係數。

### 8.2 多餐期來源案例

```text
baseQi = ni × qi / ti
baseQ  = arithmeticMean(baseQi)
Qhour  = baseQ × k
VeffRequired = Qhour / 6
```

只在明確選擇 `SOURCE_ARITHMETIC_MEAN` 且報告標示「依舊版來源案例之餐期平均」時使用。系統不得把此聚合靜默當成所有多餐期案件的尖峰設計通則。

### 8.3 面積法

```text
n = area × dinerDensity × turnover
Qhour = (n × q / t) × k
VeffRequired = Qhour / 6
```

### 8.4 實測水量法

```text
Qhour = measuredWastewaterL / operationHours × k
VeffRequired = Qhour / 6
```

### 8.5 反推

```text
nEquivalentMax = (6 × effectiveVolumeL × t) / (q × k)
areaEquivalentMax = nEquivalentMax / (dinerDensity × turnover)
```

人數向下取整；面積向下至 0.1 m²，並標示所有假設。

### 8.6 舊版用水量表

| 餐廳類別 | q 範圍 L/(人·餐) | turnover | density 人/m² |
|---|---:|---:|---:|
| 觀光飯店 | 70～120 | 3 | 0.5 |
| 中小型餐廳 | 30～50 | 5 | 0.5 |
| 西式速食 | 13～33 | 8 | 0.5 |
| 便當中心 | 25～100 | 不適用 | 不適用 |
| 機關團體餐廳 | 100～150 | 不適用 | 不適用 |

q 優先使用實測；無實測時由工程人員在來源範圍內選 exact value 並保存理由，系統不自動取平均。

### 8.7 舊版安全係數

| 類別 | 餐飲類型摘要 | 允許 k |
|---|---|---|
| A | 麻辣／涮涮鍋／火烤、牛肉麵與餡餅、牛排燒烤西餐、小吃街、清粥小菜、羊肉爐、自動洗碗機 | 1.5 |
| B | 中式菜系、包子水餃鍋貼、海鮮、小吃、豆漿、學校／機關團體、大型日本料理 | 1.3 或 1.4 |
| C | 中小型日本料理、快餐西餐、快餐、西式速食 | 1.2 或 1.3 |

B／C 類必須選擇 exact k 並填理由；未選時該軌 `INSUFFICIENT_DATA`。

## 9. 現行反推模型

### 9.1 反推每日用餐人數

```text
N_by_Q = Qcapacity × t / (Wm' × k)
N_by_G = 1000 × Gcapacity / (gu × iu + gb × ib)
N_equivalent_max = floor(min(N_by_Q, N_by_G))
```

必須顯示 Q 限制、G 限制、最終控制條件與假設。

### 9.2 反推全面積

若 n0 固定：

```text
A_by_Q = Qcapacity × t × n0 / (Wm × n × k)
A_by_G = 1000 × Gcapacity × n0 / (n × (gu × iu + gb × ib))
```

一般情況 n0 是分段內插函數，solver 必須：

1. 只對 A-36 連續有效節點建立線性區段。
2. 在每段解 `Q(A) < Qcapacity` 與 `G(A) < Gcapacity`。
3. 取共同成立的最大 A，向下至 0.1 m² 後重新驗證嚴格不等式。
4. 不跨空白區段；來源例外點只作精確點判斷。
5. 回傳控制條件、有效區段與 solver trace。

## 10. 精度與捨入

- domain 使用 decimal，資料庫正式數值至少 `numeric(24,10)`。
- `rawValue`：完整運算與匹配，不先截斷。
- `sourceDisplayValue`：重現來源顯示，只作 QA evidence。
- `adoptedValue`：正式報告採用值。
- 正向需求 Q、G、Veff：預設向上至 0.1。
- 反推人數：向下至整數。
- 反推面積：向下至 0.1 m²，向下後必須重跑限制條件。
- 正向需求與反推限制比較一律用 raw 值；不得用來源截斷值或畫面格式值。
- 任何人工採用不同值必須建立 `EngineeringOverride`，保存前值、後值、理由、依據與覆核。

## 11. 設計能力輸入與功能邊界

- 現行 T05 由使用者輸入 `Qcapacity`、`Gcapacity`、單位、資料來源與證據附件，再進行等效人數／面積反推。
- 系統只驗證數值、單位、必要假設與來源欄位完整，不驗證設備型號、額定能力真偽、證書有效性或適用標準。
- 正向計算報告只陳述設計需求 Q/G；反向報告只陳述在輸入能力與假設下的等效上限。
- 報告限制章節固定揭露「本系統未執行特定產品或證書符合性判定」。
- 產品選型或證書匹配若日後重新提出，必須依 ADR-004 建立新 ADR、DEV 與獨立驗證契約。

## 12. 雙軌完整性與放行狀態

### 12.1 TrackAssessment

每一要求軌都產生一筆評估：

```text
CALCULATED
INSUFFICIENT_DATA
INVALID
ERROR
```

保存 required fields、missing fields、validation errors、rule version、assessment time 與 release relevance。

### 12.2 案件級 CalculationStatus

| 模式 | 有效軌數 | 狀態 | 可進覆核 |
|---|---:|---|---|
| 單軌 | 1 | `COMPLETE` | 是 |
| 單軌 | 0 | `BLOCKED` | 否 |
| 雙軌 | 2 | `COMPLETE` | 是 |
| 雙軌 | 1 | `COMPLETE_WITH_REMINDER` | 是 |
| 雙軌 | 0 | `BLOCKED` | 否 |

`COMPLETE_WITH_REMINDER` 必須：

- 保留成功軌的完整、不可變 run。
- 將不足軌顯示為「未計算」，列出原因。
- `繼續覆核` 保持可用。
- 不宣稱已完成雙軌數值比較。

## 13. 案件生命週期

```text
DRAFT
  → INPUT_READY
  → CALCULATED
  → IN_REVIEW
  → REVIEWED
  → ISSUED
  → SUPERSEDED
```

轉換規則：

- `DRAFT → INPUT_READY`：單軌必要資料完整；雙軌至少一軌完整。
- `INPUT_READY → CALCULATED`：狀態為 COMPLETE 或 COMPLETE_WITH_REMINDER。
- `CALCULATED → IN_REVIEW`：工程人員提交覆核。
- `IN_REVIEW → REVIEWED`：目前使用者完成覆核；或退回 `CALCULATED` 並記錄原因。
- `REVIEWED → ISSUED`：以 reviewed revision 建立報告快照與 PDF。
- 同一 actor 可以依序完成 `CALCULATED → IN_REVIEW → REVIEWED → ISSUED`；每次轉換仍須是獨立、具名且有時間戳的 audit event。
- 已核發輸入不可修改；變更時建立新 case revision。新修訂核發後，前版標 `SUPERSEDED`，檔案保留。
- `BLOCKED` 是計算狀態，不是案件生命週期；阻擋時案件留在 DRAFT／INPUT_READY 並顯示補資料動作。

## 14. 資料模型

所有主鍵用 UUID；時間用 UTC `timestamptz`；顯示時轉 Asia/Taipei。

| Aggregate／table | 必要欄位與約束 |
|---|---|
| `users` | id、display_name、status、created_at；identity subject 透過 adapter mapping |
| `user_roles` | user_id、role；unique(user_id, role) |
| `source_documents` | code、title、authority_level、published_at、checked_at、uri、sha256、status |
| `source_discrepancies` | code、source_document_id、page、description、resolution、approved_by |
| `rule_sets` | code、version、method_family、effective_from/to、status、checksum；已 ACTIVE 不可修改 |
| `factor_tables` | rule_set_id、table_code、dimension_schema、unit_schema |
| `factor_points` | table_id、dining_type、dimension_key、value nullable、source_state；保留 VALUE／DASH／BLANK |
| `calculation_cases` | id、case_no、revision_no、customer、location、task_code、mode、lifecycle_status、created_by；unique(case_no, revision_no) |
| `case_inputs` | case_revision_id、track、field_code、raw_value、normalized_decimal、unit、source_type、evidence_uri |
| `scenario_decisions` | case_revision_id、selected_mode、reason、decided_by、decided_at |
| `assumptions` | case_revision_id、track、code、value、impact、confirmed_by |
| `track_assessments` | request_id、track、status、required_fields_json、missing_fields_json、errors_json、rule_set_id |
| `calculation_runs` | case_revision_id、track、task_code、method_code、rule_set_id、input_hash、status、result_semantics、raw_result_json、adopted_result_json；immutable |
| `calculation_steps` | run_id、sequence、formula_code、expression、substitution、result、unit、source_ref |
| `warnings` | owner_type/id、code、severity、track、message、details_json |
| `engineering_overrides` | case_revision_id、field/result path、before、after、reason、evidence、requested_by、approved_by、status；requested_by 可等於 approved_by |
| `review_records` | case_revision_id、prepared_by、reviewed_by、checklist_json、decision、note、reviewed_at；prepared_by 可等於 reviewed_by |
| `report_snapshots` | case_revision_id、snapshot_json、snapshot_hash、report_number nullable、status、created_by、issued_by、issued_at；immutable after issue |
| `audit_events` | actor_id、action、aggregate_type/id、before_hash、after_hash、metadata_json、created_at |

資料庫 constraints：

- 所有正式數值 > 0；清除週期 iu 介於 7～14，ib 介於 7～30。
- 同一 `idempotency_key + case_revision_id` 唯一。
- active RuleSet 的 code＋version 唯一且不可 update；修正建立新版本。
- issued ReportSnapshot 禁止 update／delete；作廢使用狀態與 audit，不做實體刪除。
- completed run 的 input hash、rule set 與 result 不可修改。

## 15. API／Service Contract

### 15.1 Routes

| Method | Route | 用途 |
|---|---|---|
| POST | `/api/cases` | 建立案件與 revision 1 |
| GET | `/api/cases` | 案件清單、篩選、分頁 |
| GET | `/api/cases/{caseId}` | 案件、當前 revision、狀態與摘要 |
| PATCH | `/api/cases/{caseId}/revisions/{revision}` | 只修改未核發 revision，使用 optimistic version |
| POST | `/api/cases/{caseId}/calculate` | 建立 track assessments 與成功 runs |
| POST | `/api/cases/{caseId}/submit-review` | 提交覆核 |
| POST | `/api/cases/{caseId}/review` | 接受或退回 |
| POST | `/api/cases/{caseId}/issue` | 建立快照與 PDF job/result |
| POST | `/api/cases/{caseId}/revisions` | 由已核發案件建立新修訂 |
| GET | `/api/rule-sets` | 查詢規則與來源 |
| POST | `/api/rule-sets` | 建立未啟用規則版本 |
| POST | `/api/rule-sets/{id}/activate` | 回歸通過後啟用 |

### 15.2 Calculation request

```text
CreateCalculationRequest
  caseId
  revisionNo
  taskCode
  mode
  idempotencyKey
  expectedCaseVersion
  requestedRuleSetVersion?
  currentInputs?
  legacyInputs?
```

DUAL_COMPARISON 可缺一軌輸入，甚至兩軌皆缺；service 仍回傳每軌評估與案件級 BLOCKED，而不是以模糊 400 隱藏缺口。格式錯誤或未授權仍使用 4xx。

### 15.3 Calculation response

```text
CreateCalculationResponse
  requestId
  caseId
  revisionNo
  taskCode
  mode
  methodCodes[]
  status                    // COMPLETE | COMPLETE_WITH_REMINDER | BLOCKED
  releaseEligible
  trackAssessments[]        // CALCULATED | INSUFFICIENT_DATA | INVALID | ERROR
  calculationRunIds[]       // 0, 1, or 2
  currentResult?
  legacyResult?
  warnings[]
  ruleSetSnapshots[]
  caseVersion
```

錯誤回應採 `application/problem+json`，至少含 `code`、`title`、`userMessage`、`fieldErrors`、`retryable`、`correlationId`；UI 第一行不得直接顯示內部錯誤。

## 16. Transaction、併發與失敗恢復

- 每一成功軌的 run、steps、warnings、input hash 與 rule snapshot 在同一原子交易完成。
- 雙軌由 orchestrator 以獨立 savepoint／隔離單元執行；一軌 calculator error 轉成 TrackAssessment，不得回滾另一成功軌。
- parent transaction 最後同時提交 assessments、成功 run 參照與案件級狀態；parent commit 失敗則全部不見。
- `idempotencyKey + caseRevision` 防止重送；相同 key 不同 payload 回 409。
- case revision 使用 optimistic concurrency；版本不符回 409 並提示重新載入。
- RuleSet activation 需排他鎖、checksum 與完整回歸證據；失敗保持 DRAFT。
- issue transaction 鎖定 reviewed revision，驗證未變更後建立 snapshot、audit 與 report record；PDF render 失敗可重試，但只能讀同一 snapshot。
- retry 不得建立新計算結果或新報告版本；使用 deterministic snapshot hash 去重。

## 17. 身份與權限

| 動作 | ENGINEER | RULE_ADMIN | SYSTEM_ADMIN |
|---|---:|---:|---:|
| 建立／編輯草稿案件 | ✓ | 讀 | 讀 |
| 計算／重算 | ✓ | 讀 | 讀 |
| 提交、覆核／退回 | ✓ | 讀 | 讀 |
| 核准 override | ✓ | - | 讀 |
| 預覽與核發報告 | ✓ | 讀 | 讀 |
| 建立／啟用 RuleSet | 讀 | ✓ | 讀 |
| 管理使用者角色 | - | - | ✓ |

- 同一帳號可同時具有多個 capability；第一版不要求編製與覆核帳號分離。
- 雲端 End-State 的所有業務 route 與 API 都必須 authenticated；匿名、停用帳號、過期 session、角色不足與未授權案件存取一律拒絕。
- API 必須 server-side 驗證權限；隱藏按鈕不是權限控制。
- 所有覆核、override、規則啟用與核發動作寫 audit；即使 actor 相同也不得合併事件。

## 18. ReportSnapshot 與 PDF

快照至少包含：

- 案件、revision、客戶、地點、任務、模式。
- 原始／正規化輸入、單位、證據與假設。
- TrackAssessment、CalculationRun、每一步公式與來源。
- RuleSet、FactorTable、source hash 與 discrepancy resolution。
- raw、source display、adopted result。
- warnings、override、編製／覆核／核發紀錄。
- 功能範圍聲明：未執行產品型號或證書符合性判定。
- snapshot schema version 與 hash。

PDF 章節：封面、一頁結論、案件情境、設計依據、輸入與假設、方法選擇、各軌計算、安裝維護核對、限制、簽核、來源附件。

`COMPLETE_WITH_REMINDER` 首頁固定標示「雙軌案件—單軌完成」；未完成軌章節顯示「未計算」及原因，不出現空白假數值。

正式 `reportNumber` 透過 `ReportNumberGenerator` port 產生；格式在首次 production release 前由公司確認。local/dev 使用 `DRAFT-{ULID}`，不得冒充正式核發編號。

## 19. Definition of Done

1. 五任務 × 兩單軌的 10 條必要路徑均可使用。
2. 三種模式與九個方法代碼可由 API 與 UI 明確辨識。
3. A-34～A-37 與舊版參數由版本化 seed 建立，checksum 可查。
4. 現行、舊版官方案例及來源錯字回歸全部通過。
5. 正向、反向、單位、精度、嚴格不等式及 n0 solver 測試通過。
6. 雙軌一軌成功時可覆核與核發；兩軌皆失敗才阻擋。
7. 未完成軌無假 run、假數值或跨軌借值。
8. 權限、idempotency、optimistic concurrency 與 immutable snapshot 測試通過。
9. PDF 可由 snapshot 重現，重新 render hash／內容一致。
10. SPEC-002 與 QA-001 的 UI／QC gate 通過。
11. 同一位已授權使用者不需切換帳號即可完成編製、覆核與核發，各責任事件可追溯。
12. schema、API、UI 與 PDF 均不存在產品型號或證書匹配功能。
13. 所有雲端業務 route／API 的匿名、session 過期、角色不足與未授權案件負向測試通過。

## 20. Stop Conditions

- 任一需求試圖把舊版 V 當成現行 Q/G 能力：停止該需求。
- A-36 落在無來源區間且無核准例外：阻擋現行軌，雙軌其他有效軌仍可放行。
- 舊版 exact q、t、k 或聚合方式未確定：阻擋舊版軌，其他有效軌仍可放行。
- 成功軌的 input hash、rule snapshot 或交易完整性失敗：停止整體覆核／核發。
- 已核發快照與重新運算不一致：停止核發並進行根因分析。
- 需求試圖重新加入產品型號或證書匹配：停止並依 ADR-004 重新進入人類決策。
- 雲端正式環境缺身份、session、TLS、備份或 authorization 驗證證據：停止 release，不阻擋本地 RD。
- 法規來源更新：新建 RuleSet 並重跑回歸，不直接修改 active version。

## 21. 建議程式邊界

```text
src/domain/case
src/domain/rules
src/domain/calculation/current
src/domain/calculation/legacy
src/domain/calculation/orchestration
src/domain/review
src/domain/report
src/application
src/infrastructure/db
src/infrastructure/auth
src/infrastructure/pdf
src/ui
tests/unit
tests/integration
tests/e2e
```

calculator 必須是 pure function；repository、clock、id generator、auth、PDF、storage 透過 ports/adapters 注入。
