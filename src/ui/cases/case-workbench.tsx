import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import Decimal from "decimal.js";
import { calculateCase } from "@/application/cases/calculation-service";
import { createRevision } from "@/application/cases/revision-service";
import {
  deleteCaseGroup,
  getLatestCase,
  presentCase,
} from "@/application/cases/repository";
import { toProblem } from "@/application/problem";
import { resolveN0 } from "@/domain/calculation/current";
import {
  calculationBasisDisplay,
  calculationModeDisplay,
  calculationTrackOrder,
} from "@/domain/rules/source-display";
import {
  currentAreaFactors,
  currentDinerFactors,
  currentSeatUtilization,
  legacySafetyFactors,
  type DiningType,
} from "@/domain/rules/seed-data";
import { DesignResultsTable } from "@/ui/components/design-results-table";
import {
  FieldHelpButton,
  type FieldHelpContent,
} from "@/ui/components/field-help";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";
import { StatusBadge } from "@/ui/components/status-badge";

interface PersistedResult {
  id: string;
  track: "CURRENT_QG" | "LEGACY_QV";
  methodCode: string;
  semantics: string;
  raw: Record<string, string | null>;
  adopted: Record<string, string | null>;
  createdAt: string;
}

interface Assessment {
  track: "CURRENT_QG" | "LEGACY_QV";
  status: string;
  missingFields: string[];
  errors: string[];
  releaseRelevance: string;
  assessedAt: string;
}

interface CaseDetail {
  id: string;
  caseId: string;
  case_no: string;
  revision_no: number;
  customer: string;
  location: string;
  title: string;
  purpose: string;
  dining_type: string | null;
  task_code: string;
  mode: "CURRENT_QG" | "LEGACY_QV" | "DUAL_COMPARISON";
  lifecycle_status: string;
  calculation_status: string | null;
  version: number;
  input_payload: {
    currentInputs?: Record<string, unknown>;
    legacyInputs?: Record<string, unknown>;
  };
  calculations: PersistedResult[];
  assessments: Assessment[];
  reports: Array<{ id: string; status: string; reportNumber: string | null }>;
}

const diningOptions = [
  ["CHINESE", "中餐"],
  ["WESTERN", "西餐"],
  ["JAPANESE", "和食"],
  ["RAMEN", "拉麵"],
  ["UDON_SOBA", "烏龍麵、蕎麥麵"],
  ["LIGHT_MEAL", "簡餐"],
  ["FOOD_COURT", "小吃、美食街"],
  ["FAST_FOOD", "速食"],
  ["FACTORY_CAFETERIA", "工廠員工餐廳"],
  ["STUDENT_CAFETERIA", "學生餐廳"],
  ["SCHOOL_LUNCH", "學校午餐"],
] as const;

type CurrentDiningType = DiningType;

const diningLabels = Object.fromEntries(diningOptions) as Record<
  CurrentDiningType,
  string
>;

// Keep this small client-side mirror in sync with seed-data.ts without pulling
// the full rule payload into the workbench bundle.
const currentDinerUseMinutes: Record<CurrentDiningType, string> = {
  CHINESE: "720",
  WESTERN: "720",
  JAPANESE: "720",
  RAMEN: "720",
  UDON_SOBA: "720",
  LIGHT_MEAL: "720",
  FOOD_COURT: "720",
  FAST_FOOD: "720",
  FACTORY_CAFETERIA: "600",
  STUDENT_CAFETERIA: "600",
  SCHOOL_LUNCH: "480",
};

const currentAreaUseMinutes: Partial<Record<CurrentDiningType, string>> = {
  CHINESE: "720",
  WESTERN: "720",
  JAPANESE: "720",
  RAMEN: "720",
  UDON_SOBA: "720",
  LIGHT_MEAL: "720",
  FOOD_COURT: "720",
  FAST_FOOD: "720",
  FACTORY_CAFETERIA: "600",
  STUDENT_CAFETERIA: "600",
};

const taskLabels: Record<string, string> = {
  T01_DINERS_TO_FLOW: "人數換算流量",
  T02_DINERS_TO_DESIGN: "人數規劃設計需求",
  T03_AREA_TO_FLOW: "面積換算流量",
  T04_AREA_TO_DESIGN: "面積規劃設計需求",
  T05_DESIGN_TO_DINERS_AND_AREA: "設備能力反推人數及面積",
  T06_EFFECTIVE_VOLUME_TO_FLOW: "有效容積換算設計處理水量",
};

type VisibleInputSourceType =
  | "案件資料"
  | "工程選值"
  | "設備資料"
  | "實測資料"
  | "來源表值"
  | "覆寫值";

const legacyWaterReferenceRows = [
  { category: "觀光飯店", q: "70～120", turnover: "3", density: "0.5" },
  { category: "中小型餐廳", q: "30～50", turnover: "5", density: "0.5" },
  { category: "西式速食", q: "13～33", turnover: "8", density: "0.5" },
  { category: "便當中心", q: "25～100", turnover: "不適用", density: "不適用" },
  {
    category: "機關團體餐廳",
    q: "100～150",
    turnover: "不適用",
    density: "不適用",
  },
];

const legacySafetyCategoryForms = {
  A: [
    { type: "火鍋類", detail: "麻辣、涮涮鍋、自助火鍋、火烤兩吃等" },
    { type: "麵食類", detail: "牛肉麵、餡餅類" },
    { type: "牛排類", detail: "專營牛排、羊排、燒烤類、西餐廳" },
    { type: "小吃街", detail: "百貨公司或大樓附設小吃街、飲食街" },
    { type: "清粥小吃店", detail: "各式清粥店含小菜經營業者" },
    { type: "羊肉爐類" },
    { type: "設有自動洗碗機者" },
  ],
  B: [
    { type: "火鍋類", detail: "川、粵、湘、台菜等" },
    { type: "麵食類", detail: "包子、水餃、鍋貼等" },
    { type: "海鮮店" },
    { type: "小吃店" },
    { type: "豆漿店" },
    { type: "學校、機關團體廚房" },
    { type: "大型日本料理店" },
  ],
  C: [
    { type: "日本料理店", detail: "中小型業者" },
    { type: "西餐廳", detail: "僅供應快餐業者" },
    { type: "快餐類" },
    { type: "西式速食" },
  ],
} satisfies Record<
  keyof typeof legacySafetyFactors,
  { type: string; detail?: string }[]
>;

const fieldHelp = {
  diningType: {
    description:
      "系統會依內政部給排水規範（附錄 5）選取用水、使用時間與油脂參數。請選擇最接近實際營業型態的類型。",
    note: "這個欄位不會自動代選；不確定時，請先向案件資料提供者確認。",
  },
  currentPeople: {
    description:
      "填寫一天預估服務的總用餐人數，單位為人/day；系統依內政部給排水規範（附錄 5）計算設計需求。",
    note: "請勿填單一餐期人數或同一時間在店人數。",
  },
  kitchenArea: {
    description:
      "填寫烹調、備餐與洗滌作業區面積，單位為 m²，不包含顧客用餐區。",
    note: "內政部給排水規範（附錄 5）的面積計算會將廚房面積與用餐區面積相加，兩者都要分別填寫。",
  },
  currentDiningArea: {
    description: "填寫顧客座席與實際用餐區面積，單位為 m²，不包含廚房作業區。",
    note: "算法 B 會再與廚房面積相加；雙算法比較時可選擇同步或分開輸入。",
  },
  qCapacity: {
    description:
      "填寫設備可承受的設計流量能力，單位為 L/min；系統會用來反推可支持的等效人數與面積。",
    note: "請勿填入 L/h，或把槽體容積 L 當成流量。",
  },
  gCapacity: {
    description:
      "填寫設備的油脂容納或處理能力，單位為 kg；系統會與 Q 設計能力一起判定反推上限。",
  },
  capacitySource: {
    description: "記錄設備流量與油脂能力數值的來源，讓反推結果可追溯。",
    note: "例如：型錄頁次、規格書版本、設備圖面或實測紀錄。",
  },
  actualUseMinutes: {
    description:
      "算法 B 的 t：整日廚房累計使用時間，單位為 min/day。系統會依餐飲類型帶入來源表值，並可直接編輯。",
    note: "它不是算法 A 的每餐／連續操作時間，兩者不會同步。修改查表帶入值後，才會以本案值覆寫來源表並影響 Q 計算與設備能力反推。",
  },
  greaseDays: {
    description: "填寫兩次完整清除油脂之間的天數；本算法依據允許 7～14 day。",
    note: "清除間隔越長，所需油脂容量通常越大。",
  },
  sedimentDays: {
    description: "填寫兩次完整清除殘渣之間的天數；本算法依據允許 7～30 day。",
    note: "請依案件預定的實際維護週期填寫。",
  },
  legacyPeople: {
    description:
      "填寫單一餐期的用餐人數，單位為人/餐；系統依臺北市工務局衛工處設計說明計算設計需求。",
    note: "這裡不是填每日總用餐人數。",
  },
  legacyArea: {
    description:
      "填寫顧客座席與實際用餐營業區面積，單位為 m²，不包含廚房作業區。",
    note: "算法 A 會搭配人員密度與翻桌率換算用餐人數；雙算法比較時可選擇同步或分開輸入。",
  },
  legacyDensity: {
    description:
      "填寫每平方公尺容納的人數假設，單位為人/m²；此值會影響面積換算的人數。",
    note: "應依案件條件與採用來源選值，並在參數選擇理由留下依據。",
  },
  legacyTurnover: {
    description: "填寫單一餐期或設計期間內，同一座位平均被使用的次數。",
    note: "翻桌率會直接放大由面積換算的用餐人數。",
  },
  legacyVolume: {
    description:
      "填寫油脂截留器可實際使用的有效容積，單位為 L；系統會依計算任務換算設計處理水量，或反推等效人數與面積。",
    note: "請勿填外殼的名目容積。",
  },
  legacyVolumeSource: {
    description: "記錄有效容積數值的來源，讓設計處理水量換算結果可追溯。",
    note: "例如：設備圖面、規格書、型錄頁次或現場量測紀錄。",
  },
  legacyQ: {
    description: "填寫每人每餐用水量 q，單位為 L/(人·餐)。優先採用實測值。",
    note: "沒有實測時，須從來源提供的範圍選定明確數值，不可直接取範圍平均。",
  },
  legacyHours: {
    description: "算法 A 的 t：單一餐期或連續操作期間的有效時間，單位為 h。",
    note: "它不是算法 B 的每日累計使用時間，兩者不會同步。系統會用此值計算每小時流量。",
  },
  safetyClass: {
    description:
      "依臺北市工務局衛工處設計說明的餐飲分類選擇 A、B 或 C 類，作為安全係數 k 的選值依據。",
  },
  currentWaterFactors: {
    description: "算法 B 依餐飲類型帶入人數法或面積法的用水量參數。",
    note: "表格列出各餐飲類型的適用數值；目前採用的餐飲類型會標記在表中。",
  },
  currentSafetyFactors: {
    description: "算法 B 依餐飲類型查取安全係數 k。",
    note: "面積法不適用的餐飲類型會標示為不適用。",
  },
  legacyK: {
    description: "填寫採用的安全係數：A=1.5、B=1.3 或 1.4、C=1.2 或 1.3。",
    note: "B、C 類不可只靠類別自動猜值，請確認 exact k 並留下選擇理由。",
  },
  legacyReason: {
    description: "說明 q、餐飲類別與 exact k 的選用依據，讓報告數字可追溯。",
    note: "例如：餐飲型態、來源表格、實測紀錄或工程判斷。",
  },
  selectionSourceType: {
    description: "選擇 q、餐飲分類或 exact k 的主要依據來源類型。",
    note: "這會進入報告條件摘要，讓日後能判斷數字憑什麼來。",
  },
  selectionBasis: {
    description: "用一句話說明為什麼採用本案這組算法參數或餐飲類型。",
    note: "可記錄查表分類、採用參數或覆寫時間的理由。",
  },
  selectionEvidence: {
    description: "填寫支持本案選值的文件、頁次、實測或確認紀錄。",
    note: "可留下文件名稱、頁次、量測日期或資料提供者。",
  },
} satisfies Record<string, FieldHelpContent>;

export function CaseWorkbench({ caseId }: { caseId: string }) {
  const navigate = useNavigate();
  const [item, setItem] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingRevision, setCreatingRevision] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingRevision, setConfirmingRevision] = useState(false);
  const [problem, setProblem] = useState<UiProblem | null>(null);
  const [current, setCurrent] = useState<Record<string, string>>({
    diningType: "",
    people: "100",
    greaseCleaningDays: "7",
    sedimentCleaningDays: "7",
    kitchenArea: "50",
    diningArea: "150",
    qCapacityLpm: "100",
    gCapacityKg: "30",
    evidenceSource: "客戶提供設備能力資料",
    actualUseMinutes: "",
    selectionBasis: "",
    selectionEvidence: "",
  });
  const [legacy, setLegacy] = useState<Record<string, string>>({
    people: "100",
    qLitersPerPersonMeal: "30",
    operationHours: "5",
    safetyFactor: "1.5",
    safetyClass: "A",
    selectionReason: "依來源餐飲分類選用",
    selectionSourceType: "來源表範圍選值",
    selectionBasis: "",
    selectionEvidence: "",
    areaM2: "150",
    dinerDensity: "0.5",
    turnover: "5",
    effectiveVolumeL: "500",
    evidenceSource: "製造商提供設備有效容積資料",
  });
  const [diningAreaSyncEnabled, setDiningAreaSyncEnabled] = useState(true);
  const [lastEditedDiningAreaTrack, setLastEditedDiningAreaTrack] = useState<
    "legacy" | "current"
  >("legacy");

  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      const data = presentCase(await getLatestCase(caseId)) as CaseDetail;
      setItem(data);
      const storedCurrent = data.input_payload?.currentInputs;
      const storedLegacy = data.input_payload?.legacyInputs;
      const storedCurrentValues = storedCurrent
        ? stringValues(storedCurrent)
        : undefined;
      const storedLegacyValues = storedLegacy
        ? stringValues(storedLegacy)
        : undefined;
      const currentDiningArea =
        storedCurrentValues?.diningArea ?? storedLegacyValues?.areaM2;
      const legacyDiningArea =
        storedLegacyValues?.areaM2 ?? storedCurrentValues?.diningArea;
      const hasDifferentDiningAreas =
        storedCurrentValues?.diningArea !== undefined &&
        storedLegacyValues?.areaM2 !== undefined &&
        storedCurrentValues.diningArea !== storedLegacyValues.areaM2;
      setDiningAreaSyncEnabled(!hasDifferentDiningAreas);
      setLastEditedDiningAreaTrack("legacy");
      if (
        storedCurrentValues ||
        currentDiningArea !== undefined ||
        data.dining_type
      )
        setCurrent((previous) => ({
          ...previous,
          ...(data.dining_type ? { diningType: data.dining_type } : {}),
          ...(storedCurrentValues ?? {}),
          actualUseMinutes:
            storedCurrentValues?.actualUseMinutes ??
            getCurrentUseTimeTableDefault(
              data.task_code,
              storedCurrentValues?.diningType ?? data.dining_type ?? "",
            ) ??
            "",
          ...(currentDiningArea !== undefined
            ? { diningArea: currentDiningArea }
            : {}),
        }));
      if (storedLegacyValues || legacyDiningArea !== undefined)
        setLegacy((previous) => ({
          ...previous,
          ...(storedLegacyValues ?? {}),
          selectionBasis: storedLegacyValues?.selectionBasis?.trim()
            ? storedLegacyValues.selectionBasis
            : (storedLegacyValues?.selectionReason ?? previous.selectionBasis),
          ...(legacyDiningArea !== undefined
            ? { areaM2: legacyDiningArea }
            : {}),
        }));
    } catch (error) {
      setProblem(toProblem(error, "案件載入未完成，請重試。"));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const latestResults = useMemo(() => {
    const map: Partial<Record<"CURRENT_QG" | "LEGACY_QV", PersistedResult>> =
      {};
    for (const result of item?.calculations ?? [])
      if (!map[result.track]) map[result.track] = result;
    return map;
  }, [item]);

  const designResultRuns = useMemo(
    () =>
      calculationTrackOrder
        .map((track) => latestResults[track])
        .filter((result): result is PersistedResult => Boolean(result)),
    [latestResults],
  );
  async function calculate(event: FormEvent) {
    event.preventDefault();
    if (!item) return;
    setSubmitting(true);
    setProblem(null);
    try {
      await calculateCase({
        caseId,
        revisionNo: item.revision_no,
        taskCode: item.task_code,
        mode: item.mode,
        idempotencyKey: crypto.randomUUID(),
        expectedCaseVersion: item.version,
        currentInputs:
          item.mode !== "LEGACY_QV"
            ? buildCurrentInput(item.task_code, current)
            : undefined,
        legacyInputs:
          item.mode !== "CURRENT_QG"
            ? buildLegacyInput(item.task_code, legacy)
            : undefined,
      });
      await load();
    } catch (error) {
      setProblem(
        toProblem(error, "目前未完成這次計算，已填資料仍保留。請重試。"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function requestRevision() {
    if (!item || creatingRevision) return;
    setProblem(null);
    setConfirmingRevision(true);
  }

  async function confirmRevision() {
    if (!item) return;
    setCreatingRevision(true);
    setProblem(null);
    try {
      await createRevision(caseId, item.version);
      setConfirmingRevision(false);
      await load();
    } catch (error) {
      setProblem(toProblem(error, "新版本建立未完成，請重試。"));
    } finally {
      setCreatingRevision(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="state-banner" aria-live="polite">
          載入案件中…
        </div>
      </div>
    );
  }
  if (problem && !item)
    return (
      <div className="page">
        <RuntimeError problem={problem} onRetry={() => void load()} />
      </div>
    );
  if (!item) return null;

  if (item.lifecycle_status === "DELETING") {
    async function resumeDelete() {
      setDeleting(true);
      setProblem(null);
      try {
        await deleteCaseGroup(caseId);
        navigate("/cases", { replace: true });
      } catch (error) {
        setProblem(toProblem(error, "案件刪除未完成，請重試。"));
      } finally {
        setDeleting(false);
      }
    }
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <p className="muted">
              {item.case_no}｜版本 {item.revision_no}
            </p>
            <h1>{item.title.trim() || item.case_no}</h1>
          </div>
          <div className="actions">
            <Link to="/cases">返回案件清單</Link>
          </div>
        </header>
        {problem ? (
          <RuntimeError problem={problem} onRetry={() => void resumeDelete()} />
        ) : null}
        <div className="state-banner warning">
          <strong>刪除未完成</strong>
          <p>案件正在清理目前版本與歷史版本，歷史內容暫不顯示。</p>
          <button
            className="button primary"
            type="button"
            disabled={deleting}
            onClick={() => void resumeDelete()}
          >
            {deleting ? "正在刪除…" : "繼續刪除"}
          </button>
        </div>
      </div>
    );
  }

  const readonly = ["ISSUED", "SUPERSEDED"].includes(item.lifecycle_status);
  const currentEnabled = item.mode !== "LEGACY_QV";
  const legacyEnabled = item.mode !== "CURRENT_QG";
  const displayTitle = item.title.trim() || item.case_no;
  const displayCustomer = item.customer.trim() || "未填客戶";
  const displayLocation = item.location.trim() || "未填地點";
  const hasCalculationAttempt =
    Boolean(item.calculation_status) ||
    designResultRuns.length > 0 ||
    item.assessments.length > 0;
  const calculationButtonText = hasCalculationAttempt ? "重新計算" : "開始計算";
  const submittingCalculationText = hasCalculationAttempt
    ? "正在重新計算…"
    : "正在計算…";
  const setSharedDiningArea = (value: string) => {
    setCurrent((previous) => ({ ...previous, diningArea: value }));
    setLegacy((previous) => ({ ...previous, areaM2: value }));
  };
  const setLegacyComparisonDiningArea = (value: string) => {
    setLastEditedDiningAreaTrack("legacy");
    setLegacy((previous) => ({ ...previous, areaM2: value }));
    if (diningAreaSyncEnabled)
      setCurrent((previous) => ({ ...previous, diningArea: value }));
  };
  const setCurrentComparisonDiningArea = (value: string) => {
    setLastEditedDiningAreaTrack("current");
    setCurrent((previous) => ({ ...previous, diningArea: value }));
    if (diningAreaSyncEnabled)
      setLegacy((previous) => ({ ...previous, areaM2: value }));
  };
  const handleDiningAreaSyncChange = (enabled: boolean) => {
    if (enabled) {
      const value =
        lastEditedDiningAreaTrack === "legacy"
          ? legacy.areaM2
          : current.diningArea;
      setLegacy((previous) => ({ ...previous, areaM2: value }));
      setCurrent((previous) => ({ ...previous, diningArea: value }));
    }
    setDiningAreaSyncEnabled(enabled);
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted" style={{ marginBottom: 5 }}>
            {item.case_no}｜版本 {item.revision_no}
          </p>
          <h1>{displayTitle}</h1>
          <p className="lede case-context">
            {displayCustomer}｜{displayLocation}
          </p>
        </div>
        <div className="actions case-page-actions">
          {item.reports.length > 0 &&
          item.lifecycle_status === "REPORT_DRAFT" ? (
            confirmingRevision ? (
              <div
                className="revision-confirmation"
                role="group"
                aria-labelledby="revision-confirmation-title"
              >
                <p
                  id="revision-confirmation-title"
                  className="revision-confirmation-title"
                >
                  確認建立版本 {item.revision_no + 1}
                </p>
                <p className="revision-confirmation-copy">
                  新版本會保留案件基本資料，但會清除目前計算結果與報告草稿。
                </p>
                <div className="button-row end">
                  <button
                    className="button secondary compact"
                    type="button"
                    disabled={creatingRevision}
                    onClick={() => setConfirmingRevision(false)}
                  >
                    取消
                  </button>
                  <button
                    className="button primary compact"
                    type="button"
                    disabled={creatingRevision}
                    onClick={() => void confirmRevision()}
                  >
                    {creatingRevision ? "正在建立版本…" : "確認建立版本"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="button secondary"
                type="button"
                disabled={creatingRevision}
                onClick={requestRevision}
              >
                建立新版本
              </button>
            )
          ) : null}
          <Link to="/cases">返回案件清單</Link>
          <Link to={`/cases/${item.caseId}/history`}>查看歷史版本</Link>
        </div>
      </header>

      {problem ? (
        <RuntimeError problem={problem} onRetry={() => void load()} />
      ) : null}

      <section className="panel stack" aria-label="案件狀態與下一步">
        <dl className="summary-grid">
          <div>
            <dt>計算任務</dt>
            <dd>{taskLabels[item.task_code] ?? item.task_code}</dd>
          </div>
          <div>
            <dt>模式</dt>
            <dd>
              {item.mode === "CURRENT_QG"
                ? calculationBasisDisplay.CURRENT_QG.shortLabel
                : item.mode === "LEGACY_QV"
                  ? calculationBasisDisplay.LEGACY_QV.shortLabel
                  : calculationModeDisplay.DUAL_COMPARISON.label}
            </dd>
          </div>
          <div>
            <dt>計算狀態</dt>
            <dd>
              <StatusBadge status={item.calculation_status} />
            </dd>
          </div>
        </dl>
        <NextAction item={item} placement="summary" />
      </section>

      <form className="stack" onSubmit={calculate}>
        <section className="panel">
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div>
              <h2>計算資料</h2>
            </div>
          </div>
          {item.mode === "DUAL_COMPARISON" ? (
            <DualComparisonFields
              taskCode={item.task_code}
              current={current}
              setCurrent={setCurrent}
              legacy={legacy}
              setLegacy={setLegacy}
              diningAreaSyncEnabled={diningAreaSyncEnabled}
              onDiningAreaSyncChange={handleDiningAreaSyncChange}
              onLegacyDiningAreaChange={setLegacyComparisonDiningArea}
              onCurrentDiningAreaChange={setCurrentComparisonDiningArea}
              readonly={readonly}
            />
          ) : (
            <div className="track-grid">
              {legacyEnabled ? (
                <fieldset
                  className="track-panel legacy"
                  disabled={readonly}
                  style={{ margin: 0 }}
                >
                  <legend className="legend-label">
                    {calculationBasisDisplay.LEGACY_QV.shortLabel}
                  </legend>
                  <LegacyFields
                    taskCode={item.task_code}
                    values={legacy}
                    setValues={setLegacy}
                    onSharedDiningAreaChange={setSharedDiningArea}
                  />
                </fieldset>
              ) : null}
              {currentEnabled ? (
                <fieldset
                  className="track-panel"
                  disabled={readonly}
                  style={{ margin: 0 }}
                >
                  <legend className="legend-label">
                    {calculationBasisDisplay.CURRENT_QG.shortLabel}
                  </legend>
                  <CurrentFields
                    taskCode={item.task_code}
                    values={current}
                    setValues={setCurrent}
                    onSharedDiningAreaChange={setSharedDiningArea}
                  />
                </fieldset>
              ) : null}
            </div>
          )}
          {!readonly ? (
            <div className="button-row end" style={{ marginTop: 16 }}>
              <button
                className="button primary"
                type="submit"
                disabled={submitting}
              >
                {submitting ? submittingCalculationText : calculationButtonText}
              </button>
            </div>
          ) : null}
        </section>

        {item.calculation_status || item.assessments.length > 0 ? (
          <section className="panel">
            <h2>本次設計結果</h2>
            {item.calculation_status === "COMPLETE_WITH_REMINDER" ? (
              <div
                className="state-banner warning"
                style={{ marginBottom: 16 }}
              >
                <strong>可產生報告：已有一軌完成。</strong>
                <p>另一軌未計算，不影響報告草稿；你仍可補齊後重新計算。</p>
              </div>
            ) : null}
            {item.calculation_status === "BLOCKED" ? (
              <div className="state-banner danger" style={{ marginBottom: 16 }}>
                <strong>目前無法計算：選定模式沒有有效結果。</strong>
                <p>雙軌案件請先補齊任一軌，再重新計算。</p>
              </div>
            ) : null}
            <DesignResultsTable mode={item.mode} runs={designResultRuns} />
            {isReportReady(item) ? (
              <NextAction item={item} placement="result" />
            ) : null}
          </section>
        ) : null}
      </form>
    </div>
  );
}

function NextAction({
  item,
  placement = "summary",
}: {
  item: CaseDetail;
  placement?: "summary" | "result";
}) {
  if (isReportReady(item)) {
    if (placement !== "result") return null;
    return (
      <div className="next-action">
        <Link className="button primary" to={`/cases/${item.caseId}/report`}>
          預覽報告草稿
        </Link>
      </div>
    );
  }
  if (
    ["CALCULATED", "REPORT_DRAFT", "IN_REVIEW", "REVIEWED"].includes(
      item.lifecycle_status,
    ) &&
    placement !== "result"
  ) {
    return null;
  }
  if (item.lifecycle_status === "ISSUED") {
    return (
      <div className="next-action">
        <Link className="button primary" to={`/cases/${item.caseId}/report`}>
          查看歷史報告資料
        </Link>
      </div>
    );
  }
  if (item.calculation_status === "BLOCKED") {
    return (
      <div className="state-banner danger">
        <strong>資料不足，請補齊必要欄位後重新計算。</strong>
      </div>
    );
  }
  return null;
}

function isReportReady(item: CaseDetail) {
  return (
    ["CALCULATED", "REPORT_DRAFT", "IN_REVIEW", "REVIEWED"].includes(
      item.lifecycle_status,
    ) &&
    ["COMPLETE", "COMPLETE_WITH_REMINDER"].includes(
      item.calculation_status ?? "",
    )
  );
}

function CurrentFields({
  taskCode,
  values,
  setValues,
  onSharedDiningAreaChange,
}: FieldProps) {
  const set = (key: string, value: string) =>
    setValues((previous) => {
      if (key !== "diningType") return { ...previous, [key]: value };

      const previousDefault = getCurrentUseTimeTableDefault(
        taskCode,
        previous.diningType,
      );
      const currentUseTime = previous.actualUseMinutes.trim();
      const followsTable =
        !currentUseTime || currentUseTime === previousDefault;
      return {
        ...previous,
        diningType: value,
        ...(followsTable
          ? {
              actualUseMinutes:
                getCurrentUseTimeTableDefault(taskCode, value) ?? "",
            }
          : {}),
      };
    });
  const reverse = taskCode === "T05_DESIGN_TO_DINERS_AND_AREA";
  const area =
    taskCode === "T03_AREA_TO_FLOW" || taskCode === "T04_AREA_TO_DESIGN";
  const waterFactors = getCurrentWaterFactors(taskCode, values.diningType);
  return (
    <InputMatrix>
      <SelectField
        id="current-dining"
        label="餐飲類型"
        help={fieldHelp.diningType}
        sourceType="工程選值"
        value={values.diningType}
        onChange={(value) => set("diningType", value)}
        reference={
          <>
            <CurrentWaterReference
              diningType={values.diningType}
              activeFactors={waterFactors}
            />
            <CurrentSafetyFactorReference diningType={values.diningType} />
          </>
        }
        required
      >
        <option value="" disabled>
          請選擇餐飲類型
        </option>
        {diningOptions.map(([value, label]) => (
          <option value={value} key={value}>
            {label}
          </option>
        ))}
      </SelectField>
      {!area && !reverse ? (
        <NumberField
          id="current-people"
          label="每日用餐人數"
          unit="人/day"
          help={fieldHelp.currentPeople}
          sourceType="案件資料"
          value={values.people}
          onChange={(value) => set("people", value)}
        />
      ) : null}
      {area ? (
        <>
          <NumberField
            id="kitchen-area"
            label="廚房面積"
            unit="m²"
            help={fieldHelp.kitchenArea}
            sourceType="案件資料"
            value={values.kitchenArea}
            onChange={(value) => set("kitchenArea", value)}
          />
          <NumberField
            id="dining-area"
            label="用餐區面積（兩算法共用）"
            unit="m²"
            help={fieldHelp.currentDiningArea}
            sourceType="案件資料"
            value={values.diningArea}
            onChange={onSharedDiningAreaChange}
          />
        </>
      ) : null}
      {reverse ? (
        <>
          <NumberField
            id="q-capacity"
            label="Q 設計能力"
            unit="L/min"
            help={fieldHelp.qCapacity}
            sourceType="設備資料"
            value={values.qCapacityLpm}
            onChange={(value) => set("qCapacityLpm", value)}
          />
          <NumberField
            id="g-capacity"
            label="G 設計能力"
            unit="kg"
            help={fieldHelp.gCapacity}
            sourceType="設備資料"
            value={values.gCapacityKg}
            onChange={(value) => set("gCapacityKg", value)}
          />
          <TextField
            id="capacity-source"
            label="能力資料來源／證據"
            help={fieldHelp.capacitySource}
            sourceType="設備資料"
            value={values.evidenceSource}
            onChange={(value) => set("evidenceSource", value)}
            required
          />
        </>
      ) : null}
      <NumberField
        id="grease-days"
        label="油脂清除週期"
        unit="day"
        help={fieldHelp.greaseDays}
        sourceType="案件資料"
        min="7"
        max="14"
        value={values.greaseCleaningDays}
        onChange={(value) => set("greaseCleaningDays", value)}
      />
      <NumberField
        id="sediment-days"
        label="殘渣清除週期"
        unit="day"
        help={fieldHelp.sedimentDays}
        sourceType="案件資料"
        min="7"
        max="30"
        value={values.sedimentCleaningDays}
        onChange={(value) => set("sedimentCleaningDays", value)}
      />
      <details className="input-matrix-details">
        <summary>特殊條件 / 有資料再填</summary>
        <InputMatrix nested>
          <CurrentUseTimeReference
            diningType={values.diningType}
            taskCode={taskCode}
          />
          <OptionalNumberField
            id="actual-use-minutes"
            label="算法 B：每日廚房使用時間 t"
            unit="min/day"
            help={fieldHelp.actualUseMinutes}
            reference={
              <CurrentUseTimeSourceTable
                diningType={values.diningType}
                taskCode={taskCode}
              />
            }
            sourceType={
              isCurrentUseTimeOverride(
                taskCode,
                values.diningType,
                values.actualUseMinutes,
              )
                ? "覆寫值"
                : "來源表值"
            }
            value={values.actualUseMinutes}
            onChange={(value) => set("actualUseMinutes", value)}
          />
          <CurrentUseTimeOverrideEffect
            diningType={values.diningType}
            taskCode={taskCode}
            actualUseMinutes={values.actualUseMinutes}
          />
        </InputMatrix>
      </details>
    </InputMatrix>
  );
}

function CurrentUseTimeSourceTable({
  diningType,
  taskCode,
}: {
  diningType: string;
  taskCode: string;
}) {
  const selectedDiningType = isDiningType(diningType) ? diningType : null;
  const { usesDinerMethod, usesAreaMethod } =
    getCurrentUseTimeMethods(taskCode);
  return (
    <LookupReferenceSection title="算法 B 每日使用時間 t 來源表">
      <div className="reference-table-wrap">
        <table className="reference-table lookup-reference-table current-t-table">
          <thead>
            <tr>
              <th>餐飲類型</th>
              <th>
                人數法 A-37 t
                {usesDinerMethod ? (
                  <span className="current-table-badge lookup-method-badge">
                    本案採用
                  </span>
                ) : null}
              </th>
              <th>
                面積法 A-34～A-36 t
                {usesAreaMethod ? (
                  <span className="current-table-badge lookup-method-badge">
                    本案採用
                  </span>
                ) : null}
              </th>
            </tr>
          </thead>
          <tbody>
            {diningOptions.map(([value, label]) => {
              const selected = value === selectedDiningType;
              return (
                <tr
                  aria-current={selected ? "true" : undefined}
                  className={selected ? "reference-selected" : undefined}
                  key={value}
                >
                  <th scope="row">
                    {label}
                    {selected ? (
                      <span className="current-table-badge">目前選用</span>
                    ) : null}
                  </th>
                  <td
                    data-label={`人數法 A-37 t${
                      usesDinerMethod ? "（本案採用）" : ""
                    }`}
                  >
                    {currentDinerUseMinutes[value]} min/day
                  </td>
                  <td
                    data-label={`面積法 A-34～A-36 t${
                      usesAreaMethod ? "（本案採用）" : ""
                    }`}
                  >
                    {currentAreaUseMinutes[value]
                      ? `${currentAreaUseMinutes[value]} min/day`
                      : "不適用"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        系統會依計算任務帶入適用查表值；沒有可共用的來源值時欄位留白，仍可輸入本案實際使用時間。
      </p>
    </LookupReferenceSection>
  );
}

function isDiningType(value: string): value is CurrentDiningType {
  return diningOptions.some(([option]) => option === value);
}

function CurrentUseTimeReference({
  diningType,
  taskCode,
}: {
  diningType: string;
  taskCode: string;
}) {
  const reference = buildCurrentUseTimeReference(taskCode, diningType);
  return (
    <InputMatrixDetail label="算法 B 來源表 t（每日）" sourceType="來源表值">
      <div className="current-t-reference">
        {reference ? (
          <>
            <strong>{reference.heading}</strong>
            <span>{reference.lines.join("；")}</span>
            <small>
              {getCurrentUseTimeTableDefault(taskCode, diningType)
                ? "欄位會帶入適用的來源表 t；可直接編輯為本案每日實際使用時間。"
                : taskCode === "T05_DESIGN_TO_DINERS_AND_AREA"
                  ? "兩張來源表沒有相同的共用 t 值，因此不預填；可輸入本案每日實際使用時間。"
                  : "目前餐飲類型沒有適用的來源表 t 值；可輸入本案每日實際使用時間。"}
            </small>
          </>
        ) : (
          <span>先選餐飲類型後，這裡會顯示適用的來源表 t 預設值。</span>
        )}
      </div>
    </InputMatrixDetail>
  );
}

function getCurrentWaterFactors(
  taskCode: string,
  diningType: string,
): Array<{ label: string; value: string | undefined; unit?: string }> {
  const selectedDiningType = isDiningType(diningType) ? diningType : null;
  const dinerFactors = selectedDiningType
    ? currentDinerFactors[selectedDiningType]
    : null;
  const areaFactors = selectedDiningType
    ? currentAreaFactors[selectedDiningType]
    : null;
  const areaTask =
    taskCode === "T03_AREA_TO_FLOW" || taskCode === "T04_AREA_TO_DESIGN";
  const reverseTask = taskCode === "T05_DESIGN_TO_DINERS_AND_AREA";

  if (areaTask) {
    return [{ label: "Wm", value: areaFactors?.Wm, unit: "L/(m²·day)" }];
  }
  if (reverseTask) {
    return [
      { label: "Wm′", value: dinerFactors?.WmPrime, unit: "L/人" },
      { label: "Wm", value: areaFactors?.Wm, unit: "L/(m²·day)" },
    ];
  }
  return [{ label: "Wm′", value: dinerFactors?.WmPrime, unit: "L/人" }];
}

function getCurrentUseTimeMethods(taskCode: string) {
  const reverseTask = taskCode === "T05_DESIGN_TO_DINERS_AND_AREA";
  return {
    usesDinerMethod:
      reverseTask ||
      taskCode === "T01_DINERS_TO_FLOW" ||
      taskCode === "T02_DINERS_TO_DESIGN",
    usesAreaMethod:
      reverseTask ||
      taskCode === "T03_AREA_TO_FLOW" ||
      taskCode === "T04_AREA_TO_DESIGN",
  };
}

function getLegacyComparisonMethod(taskCode: string) {
  if (taskCode === "T06_EFFECTIVE_VOLUME_TO_FLOW") return "有效容積換算";
  if (taskCode === "T05_DESIGN_TO_DINERS_AND_AREA") return "依設備有效容積反推";
  if (taskCode === "T03_AREA_TO_FLOW" || taskCode === "T04_AREA_TO_DESIGN")
    return "面積法";
  return "人數法";
}

function getCurrentComparisonMethod(taskCode: string) {
  const { usesDinerMethod, usesAreaMethod } =
    getCurrentUseTimeMethods(taskCode);
  if (usesDinerMethod && usesAreaMethod) return "人數法與面積法";
  if (usesDinerMethod) return "人數法";
  if (usesAreaMethod) return "面積法";
  return "不適用";
}

function buildCurrentUseTimeReference(taskCode: string, diningType: string) {
  if (!isDiningType(diningType)) return null;
  const { usesDinerMethod, usesAreaMethod } =
    getCurrentUseTimeMethods(taskCode);
  if (!usesDinerMethod && !usesAreaMethod) return null;
  const lines: string[] = [];

  if (usesDinerMethod) {
    lines.push(`人數法 A-37：t=${currentDinerUseMinutes[diningType]} min/day`);
  }

  if (usesAreaMethod) {
    const areaUseMinutes = currentAreaUseMinutes[diningType];
    lines.push(
      areaUseMinutes
        ? `面積法 A-34～A-36：t=${areaUseMinutes} min/day`
        : "面積法 A-34～A-36：此餐飲類型無來源表 t 值",
    );
  }

  return {
    heading: diningLabels[diningType],
    lines,
  };
}

function getCurrentUseTimeTableDefault(
  taskCode: string,
  diningType: string,
): string | null {
  if (!isDiningType(diningType)) return null;
  const { usesDinerMethod, usesAreaMethod } =
    getCurrentUseTimeMethods(taskCode);
  if (!usesDinerMethod && !usesAreaMethod) return null;

  if (usesDinerMethod && usesAreaMethod) {
    const dinerValue = currentDinerUseMinutes[diningType];
    const areaValue = currentAreaUseMinutes[diningType];
    return areaValue && dinerValue === areaValue ? dinerValue : null;
  }

  return usesAreaMethod
    ? (currentAreaUseMinutes[diningType] ?? null)
    : currentDinerUseMinutes[diningType];
}

function isCurrentUseTimeOverride(
  taskCode: string,
  diningType: string,
  actualUseMinutes: string,
) {
  const value = actualUseMinutes.trim();
  return Boolean(
    value && value !== getCurrentUseTimeTableDefault(taskCode, diningType),
  );
}

function CurrentUseTimeOverrideEffect({
  diningType,
  taskCode,
  actualUseMinutes,
}: {
  diningType: string;
  taskCode: string;
  actualUseMinutes: string;
}) {
  const effect = buildCurrentUseTimeOverrideEffect(
    taskCode,
    diningType,
    actualUseMinutes,
  );
  return (
    <InputMatrixDetail
      label="計算採用值"
      sourceType={
        isCurrentUseTimeOverride(taskCode, diningType, actualUseMinutes)
          ? "覆寫值"
          : "來源表值"
      }
    >
      <div className={`current-t-reference ${effect.tone}`} aria-live="polite">
        <strong>{effect.heading}</strong>
        {effect.lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
        <small>{effect.note}</small>
      </div>
    </InputMatrixDetail>
  );
}

function buildCurrentUseTimeOverrideEffect(
  taskCode: string,
  diningType: string,
  actualUseMinutes: string,
) {
  const reference = buildCurrentUseTimeReference(taskCode, diningType);
  if (!reference) {
    return {
      heading: "尚未判定",
      lines: ["先選餐飲類型，系統才知道要覆寫哪一個來源表 t。"],
      note: "這個欄位不會影響臺北市舊法的操作時間 t。",
      tone: "pending",
    };
  }

  const overrideValue = actualUseMinutes.trim();
  const targetText = reference.lines
    .map((line) => line.replace(/^(.+?)：t=(.+)$/, "$1 來源表 t=$2"))
    .join("；");

  if (!isCurrentUseTimeOverride(taskCode, diningType, overrideValue)) {
    const tableDefault = getCurrentUseTimeTableDefault(taskCode, diningType);
    return {
      heading:
        tableDefault && overrideValue ? "目前採用查表帶入值" : "目前未覆寫",
      lines: [`計算仍使用：${targetText}`],
      note:
        tableDefault && overrideValue
          ? "欄位目前帶入來源表預設值；可直接編輯，修改後才會覆寫。"
          : tableDefault
            ? "欄位留白時，計算仍使用來源表值；若有本案每日實際使用時間，可在上一列輸入 min/day。"
            : "目前使用來源表值；若有本案每日實際使用時間，可在上一列輸入 min/day。",
      tone: "pending",
    };
  }

  return {
    heading: "將覆寫來源表 t",
    lines: [`${targetText} → 本案 t=${overrideValue} min/day`],
    note: "此值會代入現行內政部附錄 5 的流量 Q 公式與設備能力反推。",
    tone: "active",
  };
}

interface DualComparisonFieldsProps {
  taskCode: string;
  current: Record<string, string>;
  setCurrent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  legacy: Record<string, string>;
  setLegacy: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  diningAreaSyncEnabled: boolean;
  onDiningAreaSyncChange: (enabled: boolean) => void;
  onLegacyDiningAreaChange: (value: string) => void;
  onCurrentDiningAreaChange: (value: string) => void;
  readonly: boolean;
}

function DualComparisonFields({
  taskCode,
  current,
  setCurrent,
  legacy,
  setLegacy,
  diningAreaSyncEnabled,
  onDiningAreaSyncChange,
  onLegacyDiningAreaChange,
  onCurrentDiningAreaChange,
  readonly,
}: DualComparisonFieldsProps) {
  const areaTask =
    taskCode === "T03_AREA_TO_FLOW" || taskCode === "T04_AREA_TO_DESIGN";
  const reverseTask = taskCode === "T05_DESIGN_TO_DINERS_AND_AREA";
  const volumeToFlow = taskCode === "T06_EFFECTIVE_VOLUME_TO_FLOW";
  const diningType = isDiningType(current.diningType)
    ? current.diningType
    : null;
  const dinerFactors = diningType ? currentDinerFactors[diningType] : null;
  const areaFactors = diningType ? currentAreaFactors[diningType] : null;
  const waterFactors = getCurrentWaterFactors(taskCode, current.diningType);
  const kFactors = reverseTask
    ? [
        { label: "人數法", value: dinerFactors?.k },
        { label: "面積法", value: areaFactors?.k },
      ]
    : [{ label: "查表 k", value: areaTask ? areaFactors?.k : dinerFactors?.k }];
  const factorFallback = diningType
    ? "此餐飲類型沒有可用的對應來源值"
    : "請先選擇餐飲類型";
  let currentAreaTotal: Decimal | null = null;
  if (current.diningArea.trim() && current.kitchenArea.trim()) {
    try {
      const area = new Decimal(current.diningArea).plus(current.kitchenArea);
      if (area.isFinite() && area.gt(0)) currentAreaTotal = area;
    } catch {
      currentAreaTotal = null;
    }
  }
  let currentN0: { value: string } | undefined;
  if (areaTask && diningType && currentAreaTotal) {
    try {
      const resolved = resolveN0(diningType, currentAreaTotal);
      currentN0 = { value: resolved.value.toString() };
    } catch {
      currentN0 = undefined;
    }
  }
  const areaConversionParameters = [
    {
      label: "n（餐位利用率）",
      value: diningType ? currentSeatUtilization[diningType] : undefined,
    },
    {
      label: "n₀（補正餐位利用率）",
      value: reverseTask ? "依候選面積" : currentN0?.value,
      unit: reverseTask ? "A-36 查表" : undefined,
    },
  ];
  const legacySelectionParameters = volumeToFlow
    ? [
        {
          label: "設備有效容積",
          value: legacy.effectiveVolumeL,
          unit: "L",
        },
      ]
    : [
        ...(taskCode === "T01_DINERS_TO_FLOW" ||
        taskCode === "T02_DINERS_TO_DESIGN"
          ? [{ label: "用餐人數", value: legacy.people, unit: "人/餐" }]
          : []),
        ...(areaTask
          ? [{ label: "用餐營業面積", value: legacy.areaM2, unit: "m²" }]
          : []),
        ...(reverseTask
          ? [
              {
                label: "設備有效容積",
                value: legacy.effectiveVolumeL,
                unit: "L",
              },
            ]
          : []),
        {
          label: "用水量 q",
          value: legacy.qLitersPerPersonMeal,
          unit: "L/(人·餐)",
        },
        { label: "使用時間 t", value: legacy.operationHours, unit: "h" },
        { label: "安全係數類別", value: `${legacy.safetyClass} 類` },
        { label: "安全係數 k", value: legacy.safetyFactor },
        ...(areaTask || reverseTask
          ? [
              {
                label: "人員密度",
                value: legacy.dinerDensity,
                unit: "人/m²",
              },
              { label: "翻桌率", value: legacy.turnover, unit: "次" },
            ]
          : []),
      ];
  const currentTimeReference = buildCurrentUseTimeReference(
    taskCode,
    current.diningType,
  );
  const currentTimeTableDefault = getCurrentUseTimeTableDefault(
    taskCode,
    current.diningType,
  );
  const currentTimeIsOverridden = isCurrentUseTimeOverride(
    taskCode,
    current.diningType,
    current.actualUseMinutes,
  );
  const currentAdoptedTime =
    current.actualUseMinutes.trim() ||
    currentTimeTableDefault ||
    (reverseTask && currentTimeReference ? "各自依適用表值" : undefined);
  const currentTimeHasMissingMethodValue =
    currentTimeReference?.lines.some((line) =>
      line.includes("此餐飲類型無來源表 t 值"),
    ) ?? false;
  const currentTimeSelectionStatus = currentTimeIsOverridden
    ? "使用者調整"
    : currentTimeTableDefault
      ? "使用來源表值"
      : reverseTask && currentTimeReference
        ? currentTimeHasMissingMethodValue
          ? "部分方法無來源表值"
          : "人數法與面積法各依來源表值"
        : "尚未判定";
  const currentSelectionParameters = [
    ...waterFactors,
    ...(areaTask || reverseTask ? areaConversionParameters : []),
    ...kFactors,
    {
      label: "每日使用時間 t 來源表",
      value: currentTimeReference?.lines.join("；") ?? factorFallback,
    },
    {
      label: "每日使用時間 t 計算採用",
      value: currentAdoptedTime,
      unit: currentAdoptedTime === "各自依適用表值" ? undefined : "min/day",
    },
    {
      label: "每日使用時間 t 狀態",
      value: currentTimeSelectionStatus,
    },
  ];
  const diningAreaSyncNote = diningAreaSyncEnabled
    ? "已勾選同步：修改任一側的用餐區面積，另一側會同步更新。"
    : "未勾選同步：算法 A、B 分開保存。重新勾選時以最後修改的一側同步；進入本頁後尚未修改時，以算法 A 的值同步至算法 B。";

  const setCurrentField = (key: string, value: string) =>
    setCurrent((previous) => {
      if (key !== "diningType") return { ...previous, [key]: value };

      const previousDefault = getCurrentUseTimeTableDefault(
        taskCode,
        previous.diningType,
      );
      const previousTime = previous.actualUseMinutes.trim();
      const followsTable = !previousTime || previousTime === previousDefault;
      return {
        ...previous,
        diningType: value,
        ...(followsTable
          ? {
              actualUseMinutes:
                getCurrentUseTimeTableDefault(taskCode, value) ?? "",
            }
          : {}),
      };
    });
  const setLegacyField = (key: string, value: string) =>
    setLegacy((previous) => ({ ...previous, [key]: value }));

  return (
    <fieldset
      className="comparison-fieldset"
      disabled={readonly}
      aria-label="算法 A 與算法 B 輸入資料比較"
    >
      <div className="comparison-intro">
        同一列呈現兩種算法的對應資料；單位或期間不同時會在欄位旁標示。
      </div>
      <div className="comparison-table-wrap">
        <table className="comparison-input-table">
          <thead>
            <tr>
              <th scope="col">比較項目</th>
              <th scope="col">
                {calculationBasisDisplay.LEGACY_QV.shortLabel}
              </th>
              <th scope="col">
                {calculationBasisDisplay.CURRENT_QG.shortLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {!volumeToFlow ? (
              <>
                <ComparisonRow
                  label="餐飲分類"
                  legacy={
                    <ComparisonSelectInput
                      id="comparison-safety-class"
                      label="算法 A 安全係數類別"
                      value={legacy.safetyClass}
                      onChange={(value) =>
                        setLegacy((previous) => ({
                          ...previous,
                          safetyClass: value,
                          safetyFactor:
                            value === "A"
                              ? "1.5"
                              : value === "B"
                                ? "1.3"
                                : "1.2",
                        }))
                      }
                      help={fieldHelp.safetyClass}
                      reference={
                        <LegacySafetyFactorReference
                          safetyClass={legacy.safetyClass}
                        />
                      }
                      required
                    >
                      <option value="A">A 類</option>
                      <option value="B">B 類</option>
                      <option value="C">C 類</option>
                    </ComparisonSelectInput>
                  }
                  current={
                    <ComparisonSelectInput
                      id="comparison-current-dining"
                      label="算法 B 餐飲類型"
                      value={current.diningType}
                      onChange={(value) => setCurrentField("diningType", value)}
                      help={withComparisonNote(
                        fieldHelp.diningType,
                        "算法 A 使用 A／B／C 安全係數類別；與本欄餐飲型態定義不同，不會互相帶入。",
                      )}
                      required
                    >
                      <option value="" disabled>
                        請選擇餐飲類型
                      </option>
                      {diningOptions.map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </ComparisonSelectInput>
                  }
                />

                {!areaTask && !reverseTask ? (
                  <ComparisonRow
                    label="用餐人數"
                    legacy={
                      <ComparisonNumberInput
                        id="comparison-legacy-people"
                        label="算法 A 單一餐期用餐人數"
                        unit="人/餐"
                        value={legacy.people}
                        onChange={(value) => setLegacyField("people", value)}
                        help={replaceComparisonNote(
                          fieldHelp.legacyPeople,
                          "算法 A 為人/餐的單一餐期人數；算法 B 為人/day 的每日總人數，統計範圍不同，兩欄分開輸入。",
                        )}
                        required
                      />
                    }
                    current={
                      <ComparisonNumberInput
                        id="comparison-current-people"
                        label="算法 B 每日用餐人數"
                        unit="人/day"
                        value={current.people}
                        onChange={(value) => setCurrentField("people", value)}
                        help={replaceComparisonNote(
                          fieldHelp.currentPeople,
                          "算法 B 為人/day 的每日總人數；算法 A 為人/餐的單一餐期人數。勿填同時在店人數，兩欄分開輸入。",
                        )}
                        required
                      />
                    }
                  />
                ) : null}

                {areaTask ? (
                  <>
                    <ComparisonDiningAreaRow
                      legacyValue={legacy.areaM2}
                      currentValue={current.diningArea}
                      onLegacyChange={onLegacyDiningAreaChange}
                      onCurrentChange={onCurrentDiningAreaChange}
                      syncEnabled={diningAreaSyncEnabled}
                      onSyncEnabledChange={onDiningAreaSyncChange}
                      legacyHelp={withComparisonNote(
                        fieldHelp.legacyArea,
                        diningAreaSyncNote,
                      )}
                      currentHelp={withComparisonNote(
                        fieldHelp.currentDiningArea,
                        diningAreaSyncNote,
                      )}
                    />
                    <ComparisonRow
                      label="廚房面積"
                      legacy={
                        <ComparisonStaticCell>
                          此算法不另計廚房作業區面積
                        </ComparisonStaticCell>
                      }
                      current={
                        <ComparisonNumberInput
                          id="comparison-kitchen-area"
                          label="算法 B 廚房面積"
                          unit="m²"
                          value={current.kitchenArea}
                          onChange={(value) =>
                            setCurrentField("kitchenArea", value)
                          }
                          help={fieldHelp.kitchenArea}
                          required
                        />
                      }
                    />
                  </>
                ) : null}

                {reverseTask ? (
                  <>
                    <ComparisonRow
                      label="設備有效容積"
                      legacy={
                        <ComparisonNumberInput
                          id="comparison-legacy-volume"
                          label="算法 A 設備有效容積"
                          unit="L"
                          value={legacy.effectiveVolumeL}
                          onChange={(value) =>
                            setLegacyField("effectiveVolumeL", value)
                          }
                          help={fieldHelp.legacyVolume}
                          required
                        />
                      }
                      current={
                        <ComparisonStaticCell>
                          算法 B 依 Q 與 G 設計能力反推
                        </ComparisonStaticCell>
                      }
                    />
                    <ComparisonRow
                      label="設備設計流量 Q"
                      legacy={
                        <ComparisonStaticCell>
                          算法 A 不以 Q 能力作為反推輸入
                        </ComparisonStaticCell>
                      }
                      current={
                        <ComparisonNumberInput
                          id="comparison-q-capacity"
                          label="算法 B Q 設計能力"
                          unit="L/min"
                          value={current.qCapacityLpm}
                          onChange={(value) =>
                            setCurrentField("qCapacityLpm", value)
                          }
                          help={fieldHelp.qCapacity}
                          required
                        />
                      }
                    />
                    <ComparisonRow
                      label="設備油脂能力 G"
                      legacy={
                        <ComparisonStaticCell>
                          算法 A 不使用 G 能力輸入
                        </ComparisonStaticCell>
                      }
                      current={
                        <ComparisonNumberInput
                          id="comparison-g-capacity"
                          label="算法 B G 設計能力"
                          unit="kg"
                          value={current.gCapacityKg}
                          onChange={(value) =>
                            setCurrentField("gCapacityKg", value)
                          }
                          help={fieldHelp.gCapacity}
                          required
                        />
                      }
                    />
                    <ComparisonRow
                      label="能力資料來源／證據"
                      legacy={
                        <ComparisonStaticCell>
                          依上列設備資料
                        </ComparisonStaticCell>
                      }
                      current={
                        <ComparisonTextInput
                          id="comparison-capacity-source"
                          label="算法 B 能力資料來源／證據"
                          value={current.evidenceSource}
                          onChange={(value) =>
                            setCurrentField("evidenceSource", value)
                          }
                          help={fieldHelp.capacitySource}
                          required
                        />
                      }
                    />
                  </>
                ) : null}

                <ComparisonRow
                  label="用水量參數"
                  legacy={
                    <ComparisonNumberInput
                      id="comparison-legacy-q"
                      label="算法 A 每人每餐用水量 q"
                      unit="L/(人·餐)"
                      value={legacy.qLitersPerPersonMeal}
                      onChange={(value) =>
                        setLegacyField("qLitersPerPersonMeal", value)
                      }
                      help={withComparisonNote(
                        fieldHelp.legacyQ,
                        "算法 B 的 Wm／Wm′ 定義與單位不同；兩側依各自來源輸入，數值不直接等同，也不會互相帶入。",
                      )}
                      reference={<LegacyWaterReference />}
                      required
                    />
                  }
                  current={
                    <ComparisonFactorList
                      factors={waterFactors}
                      fallback={factorFallback}
                      label="算法 B 用水量參數"
                      help={withComparisonNote(
                        fieldHelp.currentWaterFactors,
                        "算法 A 的 q 定義與單位不同；兩側依各自來源輸入，數值不直接等同，也不會互相帶入。",
                      )}
                      reference={
                        <CurrentWaterReference
                          diningType={current.diningType}
                          activeFactors={waterFactors}
                        />
                      }
                    />
                  }
                />

                <ComparisonRow
                  label="使用時間 t"
                  legacy={
                    <ComparisonNumberInput
                      id="comparison-legacy-hours"
                      label="算法 A 每餐／連續操作時間 t"
                      unit="h"
                      value={legacy.operationHours}
                      onChange={(value) =>
                        setLegacyField("operationHours", value)
                      }
                      help={fieldHelp.legacyHours}
                      required
                    />
                  }
                  current={
                    <ComparisonNumberInput
                      id="comparison-actual-use-minutes"
                      label="算法 B 每日廚房使用時間 t"
                      unit="min/day"
                      value={current.actualUseMinutes}
                      onChange={(value) =>
                        setCurrentField("actualUseMinutes", value)
                      }
                      help={fieldHelp.actualUseMinutes}
                      reference={
                        <CurrentUseTimeSourceTable
                          diningType={current.diningType}
                          taskCode={taskCode}
                        />
                      }
                    />
                  }
                />

                {(areaTask || reverseTask) && !volumeToFlow ? (
                  <ComparisonRow
                    label="面積換算參數"
                    legacy={
                      <div className="comparison-control-stack">
                        <div className="comparison-subfield">
                          <label htmlFor="comparison-legacy-density">
                            人員密度
                          </label>
                          <ComparisonNumberInput
                            id="comparison-legacy-density"
                            label="算法 A 人員密度"
                            unit="人/m²"
                            value={legacy.dinerDensity}
                            onChange={(value) =>
                              setLegacyField("dinerDensity", value)
                            }
                            help={withComparisonNote(
                              fieldHelp.legacyDensity,
                              "本算法的密度由使用者輸入；算法 B 面積法依其來源表，不會由此欄帶入。",
                            )}
                            reference={<LegacyWaterReference />}
                            required
                          />
                        </div>
                        <div className="comparison-subfield">
                          <label htmlFor="comparison-legacy-turnover">
                            翻桌率
                          </label>
                          <ComparisonNumberInput
                            id="comparison-legacy-turnover"
                            label="算法 A 翻桌率"
                            unit="次"
                            value={legacy.turnover}
                            onChange={(value) =>
                              setLegacyField("turnover", value)
                            }
                            help={withComparisonNote(
                              fieldHelp.legacyTurnover,
                              "本算法的翻桌率由使用者輸入；算法 B 面積法依其來源表，不會由此欄帶入。",
                            )}
                            reference={<LegacyWaterReference />}
                            required
                          />
                        </div>
                      </div>
                    }
                    current={
                      <ComparisonFactorList
                        factors={areaConversionParameters}
                        fallback={factorFallback}
                        label="算法 B 面積換算參數"
                        help={{
                          description:
                            "算法 B 面積法使用附錄 5 的 n 與 n₀進行面積補正：n（餐位利用率）依餐飲類型帶入，n₀（補正餐位利用率）依用餐區與廚房總面積 A 查 A-36 表，必要時在相鄰有效節點間內插。因此不另輸入算法 A 的人員密度與翻桌率。",
                          note: "畫面列出目前帶入的 n、n₀。反推任務尚未得到面積時，n₀會依各候選面積查表。",
                        }}
                      />
                    }
                  />
                ) : null}

                <ComparisonRow
                  label="安全係數 k"
                  legacy={
                    <ComparisonNumberInput
                      id="comparison-legacy-k"
                      label="算法 A exact k"
                      unit="ratio"
                      value={legacy.safetyFactor}
                      onChange={(value) =>
                        setLegacyField("safetyFactor", value)
                      }
                      help={withComparisonNote(
                        fieldHelp.legacyK,
                        "算法 A 可編輯 exact k；算法 B 依餐飲類型查表帶入。兩側來源不同，不會互相帶入。",
                      )}
                      reference={
                        <LegacySafetyFactorReference
                          safetyClass={legacy.safetyClass}
                        />
                      }
                      required
                    />
                  }
                  current={
                    <ComparisonFactorList
                      factors={kFactors}
                      fallback={factorFallback}
                      label="算法 B 安全係數 k"
                      help={withComparisonNote(
                        fieldHelp.currentSafetyFactors,
                        "算法 B 依餐飲類型查表帶入；算法 A 可編輯 exact k。兩側來源不同，不會互相帶入。",
                      )}
                      reference={
                        <CurrentSafetyFactorReference
                          diningType={current.diningType}
                        />
                      }
                    />
                  }
                />

                <ComparisonRow
                  label="油脂清除週期"
                  legacy={
                    <ComparisonStaticCell>
                      此算法未使用此週期
                    </ComparisonStaticCell>
                  }
                  current={
                    <ComparisonNumberInput
                      id="comparison-grease-days"
                      label="算法 B 油脂清除週期"
                      unit="day"
                      min="7"
                      max="14"
                      value={current.greaseCleaningDays}
                      onChange={(value) =>
                        setCurrentField("greaseCleaningDays", value)
                      }
                      help={fieldHelp.greaseDays}
                      required
                    />
                  }
                />
                <ComparisonRow
                  label="殘渣清除週期"
                  legacy={
                    <ComparisonStaticCell>
                      此算法未使用此週期
                    </ComparisonStaticCell>
                  }
                  current={
                    <ComparisonNumberInput
                      id="comparison-sediment-days"
                      label="算法 B 殘渣清除週期"
                      unit="day"
                      min="7"
                      max="30"
                      value={current.sedimentCleaningDays}
                      onChange={(value) =>
                        setCurrentField("sedimentCleaningDays", value)
                      }
                      help={fieldHelp.sedimentDays}
                      required
                    />
                  }
                />
              </>
            ) : (
              <>
                <ComparisonRow
                  label="設備有效容積"
                  legacy={
                    <ComparisonNumberInput
                      id="comparison-legacy-volume-only"
                      label="算法 A 設備有效容積"
                      unit="L"
                      value={legacy.effectiveVolumeL}
                      onChange={(value) =>
                        setLegacyField("effectiveVolumeL", value)
                      }
                      help={fieldHelp.legacyVolume}
                      required
                    />
                  }
                  current={
                    <ComparisonStaticCell>此任務未使用</ComparisonStaticCell>
                  }
                />
              </>
            )}
          </tbody>
        </table>
      </div>

      <details className="comparison-details" open>
        <summary>本案選值依據</summary>
        <p className="comparison-basis-intro">
          依相同順序查看兩種算法的計算方法、資料來源、本案參數與選值理由。
        </p>
        <div className="comparison-details-grid comparison-basis-grid">
          <section className="comparison-basis-track">
            <h3>{calculationBasisDisplay.LEGACY_QV.shortLabel}</h3>
            <div className="comparison-basis-field">
              <span className="comparison-basis-label">本案計算方法</span>
              <p className="comparison-basis-readonly">
                {getLegacyComparisonMethod(taskCode)}
              </p>
            </div>
            <div className="comparison-basis-field">
              <label
                className="comparison-basis-label"
                htmlFor={
                  volumeToFlow
                    ? "comparison-legacy-volume-source"
                    : "comparison-selection-source"
                }
              >
                資料來源
              </label>
              {volumeToFlow ? (
                <ComparisonTextInput
                  id="comparison-legacy-volume-source"
                  label="算法 A 有效容積資料來源／證據"
                  value={legacy.evidenceSource}
                  onChange={(value) => setLegacyField("evidenceSource", value)}
                  help={fieldHelp.legacyVolumeSource}
                  required
                />
              ) : (
                <div className="comparison-basis-control-main">
                  <select
                    id="comparison-selection-source"
                    aria-label="算法 A 資料來源類型"
                    value={legacy.selectionSourceType}
                    onChange={(event) =>
                      setLegacyField("selectionSourceType", event.target.value)
                    }
                    required
                  >
                    <option value="來源表範圍選值">來源表範圍選值</option>
                    <option value="客戶提供資料">客戶提供資料</option>
                    <option value="實測/現場紀錄">實測/現場紀錄</option>
                    <option value="工程保守判斷">工程保守判斷</option>
                  </select>
                  <FieldHelpButton
                    ariaLabel="算法 A 資料來源類型說明"
                    help={fieldHelp.selectionSourceType}
                    showText={false}
                    title="資料來源"
                  />
                </div>
              )}
            </div>
            <div className="comparison-basis-field">
              <span className="comparison-basis-label">本案採用參數</span>
              <ComparisonBasisValueList values={legacySelectionParameters} />
            </div>
            {!volumeToFlow ? (
              <ComparisonBasisTextarea
                id="comparison-selection-basis"
                label="選值理由（選填）"
                value={legacy.selectionBasis}
                onChange={(value) => setLegacyField("selectionBasis", value)}
                help={fieldHelp.selectionBasis}
                placeholder="可補充餐飲分類、參考表或採用這組參數的理由"
              />
            ) : null}
            <details className="comparison-basis-evidence">
              <summary>補充資料（選填）</summary>
              {!volumeToFlow ? (
                <ComparisonBasisTextarea
                  id="comparison-selection-evidence"
                  label="文件或紀錄"
                  value={legacy.selectionEvidence}
                  onChange={(value) =>
                    setLegacyField("selectionEvidence", value)
                  }
                  help={fieldHelp.selectionEvidence}
                  placeholder="文件名稱、頁次、量測或確認紀錄"
                />
              ) : (
                <p className="comparison-basis-readonly">
                  {legacy.evidenceSource ||
                    "請填寫設備有效容積的資料來源／證據。"}
                </p>
              )}
            </details>
          </section>
          <section className="comparison-basis-track">
            <h3>{calculationBasisDisplay.CURRENT_QG.shortLabel}</h3>
            <div className="comparison-basis-field">
              <span className="comparison-basis-label">本案計算方法</span>
              <p className="comparison-basis-readonly">
                {getCurrentComparisonMethod(taskCode)}
                {diningType
                  ? `・${diningLabels[diningType]}`
                  : "・請先選擇餐飲類型"}
              </p>
            </div>
            <div className="comparison-basis-field">
              <span className="comparison-basis-label">資料來源</span>
              <p className="comparison-basis-readonly">
                內政部給排水規範（附錄 5）
                <small>依上列計算方法與餐飲類型套用來源表</small>
              </p>
            </div>
            <div className="comparison-basis-field">
              <span className="comparison-basis-label">本案採用參數</span>
              <ComparisonBasisValueList values={currentSelectionParameters} />
            </div>
            <ComparisonBasisTextarea
              id="comparison-current-selection-basis"
              label="選值理由（選填）"
              value={current.selectionBasis}
              onChange={(value) => setCurrentField("selectionBasis", value)}
              help={fieldHelp.selectionBasis}
              placeholder="可補充餐飲類型、查表值或覆寫時間的採用理由"
            />
            <details className="comparison-basis-evidence">
              <summary>補充資料（選填）</summary>
              <ComparisonBasisTextarea
                id="comparison-current-selection-evidence"
                label="文件或紀錄"
                value={current.selectionEvidence}
                onChange={(value) =>
                  setCurrentField("selectionEvidence", value)
                }
                help={fieldHelp.selectionEvidence}
                placeholder="文件名稱、頁次、量測或確認紀錄"
              />
            </details>
          </section>
        </div>
      </details>
    </fieldset>
  );
}

function LegacyFields({
  taskCode,
  values,
  setValues,
  onSharedDiningAreaChange,
}: FieldProps) {
  const set = (key: string, value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));
  const reverse = taskCode === "T05_DESIGN_TO_DINERS_AND_AREA";
  const volumeToFlow = taskCode === "T06_EFFECTIVE_VOLUME_TO_FLOW";
  const area =
    taskCode === "T03_AREA_TO_FLOW" || taskCode === "T04_AREA_TO_DESIGN";
  if (volumeToFlow) {
    return (
      <InputMatrix>
        <NumberField
          id="legacy-volume"
          label="設備有效容積"
          unit="L"
          help={fieldHelp.legacyVolume}
          sourceType="設備資料"
          value={values.effectiveVolumeL}
          onChange={(value) => set("effectiveVolumeL", value)}
        />
        <TextField
          id="legacy-volume-source"
          label="有效容積資料來源／證據"
          help={fieldHelp.legacyVolumeSource}
          sourceType="設備資料"
          value={values.evidenceSource}
          onChange={(value) => set("evidenceSource", value)}
          required
        />
      </InputMatrix>
    );
  }
  return (
    <InputMatrix>
      {!area && !reverse ? (
        <NumberField
          id="legacy-people"
          label="用餐人數"
          unit="人/餐"
          help={fieldHelp.legacyPeople}
          sourceType="案件資料"
          value={values.people}
          onChange={(value) => set("people", value)}
        />
      ) : null}
      {area ? (
        <>
          <NumberField
            id="legacy-area"
            label="用餐區面積（兩算法共用）"
            unit="m²"
            help={fieldHelp.legacyArea}
            sourceType="案件資料"
            value={values.areaM2}
            onChange={onSharedDiningAreaChange}
          />
          <NumberField
            id="legacy-density"
            label="人員密度"
            unit="人/m²"
            help={fieldHelp.legacyDensity}
            sourceType="工程選值"
            value={values.dinerDensity}
            onChange={(value) => set("dinerDensity", value)}
          >
            <LegacyWaterReference />
          </NumberField>
          <NumberField
            id="legacy-turnover"
            label="翻桌率"
            unit="次"
            help={fieldHelp.legacyTurnover}
            sourceType="工程選值"
            value={values.turnover}
            onChange={(value) => set("turnover", value)}
          >
            <LegacyWaterReference />
          </NumberField>
        </>
      ) : null}
      {reverse ? (
        <>
          <NumberField
            id="legacy-volume"
            label="有效容積"
            unit="L"
            help={fieldHelp.legacyVolume}
            sourceType="設備資料"
            value={values.effectiveVolumeL}
            onChange={(value) => set("effectiveVolumeL", value)}
          />
          <NumberField
            id="legacy-density-rev"
            label="人員密度"
            unit="人/m²"
            help={fieldHelp.legacyDensity}
            sourceType="工程選值"
            value={values.dinerDensity}
            onChange={(value) => set("dinerDensity", value)}
          >
            <LegacyWaterReference />
          </NumberField>
          <NumberField
            id="legacy-turnover-rev"
            label="翻桌率"
            unit="次"
            help={fieldHelp.legacyTurnover}
            sourceType="工程選值"
            value={values.turnover}
            onChange={(value) => set("turnover", value)}
          >
            <LegacyWaterReference />
          </NumberField>
        </>
      ) : null}
      <NumberField
        id="legacy-q"
        label="每人每餐用水量 q"
        unit="L/(人·餐)"
        help={fieldHelp.legacyQ}
        sourceType="工程選值"
        value={values.qLitersPerPersonMeal}
        onChange={(value) => set("qLitersPerPersonMeal", value)}
      >
        <LegacyWaterReference />
      </NumberField>
      <NumberField
        id="legacy-hours"
        label="算法 A：每餐／連續操作時間 t"
        unit="h"
        help={fieldHelp.legacyHours}
        sourceType="案件資料"
        value={values.operationHours}
        onChange={(value) => set("operationHours", value)}
      />
      <SelectField
        id="safety-class"
        label="安全係數類別"
        help={fieldHelp.safetyClass}
        sourceType="工程選值"
        value={values.safetyClass}
        reference={
          <LegacySafetyFactorReference safetyClass={values.safetyClass} />
        }
        onChange={(safetyClass) => {
          setValues((previous) => ({
            ...previous,
            safetyClass,
            safetyFactor:
              safetyClass === "A" ? "1.5" : safetyClass === "B" ? "1.3" : "1.2",
          }));
        }}
      >
        <option value="A">A 類</option>
        <option value="B">B 類</option>
        <option value="C">C 類</option>
      </SelectField>
      <NumberField
        id="legacy-k"
        label="exact k"
        unit="ratio"
        help={fieldHelp.legacyK}
        sourceType="工程選值"
        value={values.safetyFactor}
        onChange={(value) => set("safetyFactor", value)}
      >
        <LegacySafetyFactorReference safetyClass={values.safetyClass} />
      </NumberField>
      <SelectField
        id="selection-source-type"
        label="選值來源類型"
        help={fieldHelp.selectionSourceType}
        sourceType="工程選值"
        value={values.selectionSourceType}
        onChange={(value) => set("selectionSourceType", value)}
        required
      >
        <option value="來源表範圍選值">來源表範圍選值</option>
        <option value="客戶提供資料">客戶提供資料</option>
        <option value="實測/現場紀錄">實測/現場紀錄</option>
        <option value="工程保守判斷">工程保守判斷</option>
      </SelectField>
      <TextField
        id="selection-basis"
        label="選值理由（選填）"
        help={fieldHelp.selectionBasis}
        sourceType="工程選值"
        value={values.selectionBasis}
        onChange={(value) => set("selectionBasis", value)}
      />
      <TextField
        id="selection-evidence"
        label="證據備註"
        help={fieldHelp.selectionEvidence}
        sourceType="工程選值"
        value={values.selectionEvidence}
        onChange={(value) => set("selectionEvidence", value)}
      />
    </InputMatrix>
  );
}

interface FieldProps {
  taskCode: string;
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSharedDiningAreaChange: (value: string) => void;
}

function NumberField({
  id,
  label,
  unit,
  help,
  sourceType,
  value,
  onChange,
  min = "0.000001",
  max,
  children,
}: {
  id: string;
  label: string;
  unit: string;
  help: FieldHelpContent;
  sourceType: VisibleInputSourceType;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  children?: ReactNode;
}) {
  return (
    <InputMatrixRow
      id={id}
      label={label}
      help={help}
      sourceType={sourceType}
      reference={children}
    >
      <InputWithUnit unit={unit}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          min={min}
          max={max}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </InputWithUnit>
    </InputMatrixRow>
  );
}

function OptionalNumberField({
  id,
  label,
  unit,
  help,
  reference,
  sourceType,
  value,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  help: FieldHelpContent;
  reference?: ReactNode;
  sourceType: VisibleInputSourceType;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <InputMatrixRow
      id={id}
      label={label}
      help={help}
      sourceType={sourceType}
      reference={reference}
    >
      <InputWithUnit unit={unit}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          min="0.000001"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </InputWithUnit>
    </InputMatrixRow>
  );
}

function TextField({
  id,
  label,
  help,
  sourceType,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  help: FieldHelpContent;
  sourceType: VisibleInputSourceType;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <InputMatrixRow id={id} label={label} help={help} sourceType={sourceType}>
      <input
        id={id}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </InputMatrixRow>
  );
}

function SelectField({
  id,
  label,
  help,
  sourceType,
  value,
  onChange,
  required,
  children,
  reference,
}: {
  id: string;
  label: string;
  help: FieldHelpContent;
  sourceType: VisibleInputSourceType;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  children: ReactNode;
  reference?: ReactNode;
}) {
  return (
    <InputMatrixRow
      id={id}
      label={label}
      help={help}
      sourceType={sourceType}
      reference={reference}
    >
      <select
        id={id}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </InputMatrixRow>
  );
}

function InputWithUnit({
  unit,
  children,
}: {
  unit: string;
  children: ReactNode;
}) {
  return (
    <div className="input-with-unit">
      {children}
      <span aria-hidden="true">{unit}</span>
    </div>
  );
}

function InputMatrix({
  children,
  nested = false,
}: {
  children: ReactNode;
  nested?: boolean;
}) {
  return (
    <div className={`input-matrix${nested ? " nested" : ""}`}>
      {nested ? null : (
        <div className="input-matrix-header" aria-hidden="true">
          <span>條件</span>
          <span>輸入值</span>
          <span>說明</span>
        </div>
      )}
      {children}
    </div>
  );
}

function InputMatrixRow({
  id,
  label,
  help,
  reference,
  children,
}: {
  id: string;
  label: string;
  help: FieldHelpContent;
  reference?: ReactNode;
  sourceType: VisibleInputSourceType;
  children: ReactNode;
}) {
  return (
    <div className="input-matrix-row">
      <div className="input-matrix-condition">
        <label htmlFor={id}>{label}</label>
      </div>
      <div className="input-matrix-control">{children}</div>
      <div className="input-matrix-help">
        <FieldHelpButton
          ariaLabel={`${label}說明`}
          help={help}
          reference={reference}
          showText={false}
          title={label}
        />
      </div>
    </div>
  );
}

function InputMatrixDetail({
  label,
  children,
}: {
  label: string;
  sourceType: VisibleInputSourceType;
  children: ReactNode;
}) {
  return (
    <div className="input-matrix-row input-matrix-detail-row">
      <div className="input-matrix-condition">
        <span>{label}</span>
      </div>
      <div className="input-matrix-detail-content">{children}</div>
      <div className="input-matrix-help" aria-hidden="true" />
    </div>
  );
}

function withComparisonNote(
  help: FieldHelpContent,
  note: string,
): FieldHelpContent {
  return {
    ...help,
    note: help.note ? `${help.note} ${note}` : note,
  };
}

function replaceComparisonNote(
  help: FieldHelpContent,
  note: string,
): FieldHelpContent {
  return { ...help, note };
}

function ComparisonRow({
  label,
  legacy,
  current,
}: {
  label: string;
  legacy: ReactNode;
  current: ReactNode;
}) {
  return (
    <tr>
      <th scope="row">
        <span>{label}</span>
      </th>
      <td data-algorithm="算法 A">{legacy}</td>
      <td data-algorithm="算法 B">{current}</td>
    </tr>
  );
}

function ComparisonDiningAreaRow({
  legacyValue,
  currentValue,
  onLegacyChange,
  onCurrentChange,
  syncEnabled,
  onSyncEnabledChange,
  legacyHelp,
  currentHelp,
}: {
  legacyValue: string;
  currentValue: string;
  onLegacyChange: (value: string) => void;
  onCurrentChange: (value: string) => void;
  syncEnabled: boolean;
  onSyncEnabledChange: (enabled: boolean) => void;
  legacyHelp: FieldHelpContent;
  currentHelp: FieldHelpContent;
}) {
  return (
    <tr>
      <th scope="row">
        <span>用餐區面積</span>
        <label className="comparison-area-sync-toggle">
          <input
            type="checkbox"
            checked={syncEnabled}
            onChange={(event) => onSyncEnabledChange(event.target.checked)}
            aria-label="同步算法 A 與算法 B 的用餐區面積"
          />
          <span>同步兩邊</span>
        </label>
      </th>
      <td data-algorithm="算法 A">
        <ComparisonNumberInput
          id="comparison-legacy-dining-area"
          label="算法 A 用餐區面積"
          unit="m²"
          value={legacyValue}
          onChange={onLegacyChange}
          help={legacyHelp}
          required
        />
      </td>
      <td data-algorithm="算法 B">
        <ComparisonNumberInput
          id="comparison-current-dining-area"
          label="算法 B 用餐區面積"
          unit="m²"
          value={currentValue}
          onChange={onCurrentChange}
          help={currentHelp}
          required
        />
      </td>
    </tr>
  );
}

function ComparisonNumberInput({
  id,
  label,
  unit,
  value,
  onChange,
  help,
  reference,
  min = "0.000001",
  max,
  required = false,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  help: FieldHelpContent;
  reference?: ReactNode;
  min?: string;
  max?: string;
  required?: boolean;
}) {
  return (
    <div className="comparison-control">
      <div className="comparison-control-main">
        <InputWithUnit unit={unit}>
          <input
            id={id}
            type="number"
            inputMode="decimal"
            step="any"
            min={min}
            max={max}
            required={required}
            aria-label={label}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </InputWithUnit>
        <FieldHelpButton
          ariaLabel={`${label}說明`}
          help={help}
          reference={reference}
          showText={false}
          title={label}
        />
      </div>
    </div>
  );
}

function ComparisonTextInput({
  id,
  label,
  value,
  onChange,
  help,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  help: FieldHelpContent;
  required?: boolean;
}) {
  return (
    <div className="comparison-control">
      <div className="comparison-control-main">
        <input
          id={id}
          required={required}
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <FieldHelpButton
          ariaLabel={`${label}說明`}
          help={help}
          showText={false}
          title={label}
        />
      </div>
    </div>
  );
}

function ComparisonBasisValueList({
  values,
}: {
  values: Array<{ label: string; value: string | undefined; unit?: string }>;
}) {
  return (
    <dl className="comparison-basis-values">
      {values.map(({ label, value, unit }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            {value?.trim() || "尚無可用值"}
            {value?.trim() && unit ? <span>{unit}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ComparisonBasisTextarea({
  id,
  label,
  value,
  onChange,
  help,
  placeholder,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  help: FieldHelpContent;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="comparison-basis-field">
      <div className="comparison-basis-label-row">
        <label htmlFor={id}>{label}</label>
        {required ? (
          <span className="comparison-basis-required">必填</span>
        ) : null}
      </div>
      <div className="comparison-basis-control-main">
        <textarea
          id={id}
          required={required}
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        <FieldHelpButton
          ariaLabel={`${label}說明`}
          help={help}
          showText={false}
          title={label}
        />
      </div>
    </div>
  );
}

function ComparisonSelectInput({
  id,
  label,
  value,
  onChange,
  help,
  reference,
  required = false,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  help: FieldHelpContent;
  reference?: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="comparison-control">
      <div className="comparison-control-main">
        <select
          id={id}
          required={required}
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {children}
        </select>
        <FieldHelpButton
          ariaLabel={`${label}說明`}
          help={help}
          reference={reference}
          showText={false}
          title={label}
        />
      </div>
    </div>
  );
}

function ComparisonFactorList({
  factors,
  fallback,
  label,
  help,
  reference,
}: {
  factors: Array<{ label: string; value: string | undefined; unit?: string }>;
  fallback: string;
  label: string;
  help: FieldHelpContent;
  reference?: ReactNode;
}) {
  const available = factors.filter(
    (factor): factor is { label: string; value: string; unit?: string } =>
      Boolean(factor.value),
  );
  return (
    <div className="comparison-control-main comparison-factor-help">
      <div className="comparison-factor-list">
        {available.length === 0 ? (
          <ComparisonStaticCell>{fallback}</ComparisonStaticCell>
        ) : (
          available.map((factor) => (
            <div key={factor.label}>
              <span>{factor.label}</span>
              <output>{factor.value}</output>
              {factor.unit ? <small>{factor.unit}</small> : null}
            </div>
          ))
        )}
      </div>
      <FieldHelpButton
        ariaLabel={`${label}說明`}
        help={help}
        reference={reference}
        showText={false}
        title={label}
      />
    </div>
  );
}

function ComparisonStaticCell({
  children,
  help,
  label,
}: {
  children: ReactNode;
  help?: FieldHelpContent;
  label?: string;
}) {
  return (
    <div
      className={`comparison-static-cell${
        help ? " comparison-static-cell--help" : ""
      }`}
    >
      <span>{children}</span>
      {help && label ? (
        <FieldHelpButton
          ariaLabel={`${label}說明`}
          help={help}
          showText={false}
          title={label}
        />
      ) : null}
    </div>
  );
}

function LookupReferenceSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="lookup-reference-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function LegacyWaterReference() {
  const table = (
    <>
      <div className="reference-table-wrap">
        <table className="reference-table lookup-reference-table">
          <thead>
            <tr>
              <th>餐廳類別</th>
              <th>q 範圍 L/(人·餐)</th>
              <th>翻桌率</th>
              <th>密度 人/m²</th>
            </tr>
          </thead>
          <tbody>
            {legacyWaterReferenceRows.map((row) => (
              <tr key={row.category}>
                <th scope="row">{row.category}</th>
                <td>{row.q}</td>
                <td>{row.turnover}</td>
                <td>{row.density}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        q 優先採用實測；無實測時在來源範圍內選 exact
        value，可於選值理由補充依據。
      </p>
    </>
  );

  return (
    <LookupReferenceSection title="算法 A 用水量參考表">
      {table}
    </LookupReferenceSection>
  );
}

function CurrentWaterReference({
  diningType,
  activeFactors,
}: {
  diningType: string;
  activeFactors: Array<{
    label: string;
    value: string | undefined;
    unit?: string;
  }>;
}) {
  const selectedDiningType = isDiningType(diningType) ? diningType : null;
  const usesDinerMethod = activeFactors.some(
    (factor) => factor.label === "Wm′",
  );
  const usesAreaMethod = activeFactors.some((factor) => factor.label === "Wm");

  return (
    <LookupReferenceSection title="算法 B 用水量參考表">
      <div className="reference-table-wrap">
        <table className="reference-table lookup-reference-table">
          <thead>
            <tr>
              <th scope="col">餐飲類型</th>
              <th scope="col">
                人數法 Wm′（L/人）
                {usesDinerMethod ? (
                  <span className="current-table-badge lookup-method-badge">
                    本案採用
                  </span>
                ) : null}
              </th>
              <th scope="col">
                面積法 Wm（L/(m²·day)）
                {usesAreaMethod ? (
                  <span className="current-table-badge lookup-method-badge">
                    本案採用
                  </span>
                ) : null}
              </th>
            </tr>
          </thead>
          <tbody>
            {diningOptions.map(([value, label]) => {
              const selected = value === selectedDiningType;
              return (
                <tr
                  aria-current={selected ? "true" : undefined}
                  className={selected ? "reference-selected" : undefined}
                  key={value}
                >
                  <th scope="row">
                    {label}
                    {selected ? (
                      <span className="current-table-badge">目前選用</span>
                    ) : null}
                  </th>
                  <td>
                    {currentDinerFactors[value as CurrentDiningType].WmPrime}
                  </td>
                  <td>
                    {currentAreaFactors[value as CurrentDiningType]?.Wm ??
                      "不適用"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </LookupReferenceSection>
  );
}

function LegacySafetyFactorReference({ safetyClass }: { safetyClass: string }) {
  const selectedClass = Object.hasOwn(legacySafetyFactors, safetyClass)
    ? (safetyClass as keyof typeof legacySafetyFactors)
    : null;

  return (
    <LookupReferenceSection title="算法 A 安全係數 k 參考表">
      <div className="reference-table-wrap">
        <table className="reference-table lookup-reference-table legacy-safety-reference-table">
          <thead>
            <tr>
              <th scope="col">安全係數類別</th>
              <th scope="col">餐飲形式／條件</th>
              <th scope="col">可選 exact k</th>
            </tr>
          </thead>
          <tbody>
            {(
              Object.keys(legacySafetyFactors) as Array<
                keyof typeof legacySafetyFactors
              >
            ).map((category) => {
              const selected = category === selectedClass;
              const forms = legacySafetyCategoryForms[category];
              return (
                <tr
                  aria-current={selected ? "true" : undefined}
                  className={selected ? "reference-selected" : undefined}
                  key={category}
                >
                  <th scope="row">
                    {category} 類
                    {selected ? (
                      <span className="current-table-badge">目前選用</span>
                    ) : null}
                  </th>
                  <td>
                    <ul className="legacy-safety-form-list">
                      {forms.map(({ type, detail }) => (
                        <li key={type}>
                          <strong>{type}</strong>
                          {detail ? `：${detail}` : null}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>{legacySafetyFactors[category].join("、")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="legacy-safety-source">
        類別會帶入預設 k；exact k 仍可依本案工程條件調整。來源：
        <a
          href="/rule-sources/SRC-LEGACY-FULL-taipei-grease-interceptor-design.pdf#page=6"
          target="_blank"
          rel="noreferrer"
        >
          SRC-LEGACY-FULL《油脂截留器使用維護及設計說明》（PDF p.6–7）
        </a>
      </p>
    </LookupReferenceSection>
  );
}

function CurrentSafetyFactorReference({ diningType }: { diningType: string }) {
  const selectedDiningType = isDiningType(diningType) ? diningType : null;

  return (
    <LookupReferenceSection title="算法 B 安全係數 k 參考表">
      <div className="reference-table-wrap">
        <table className="reference-table lookup-reference-table">
          <thead>
            <tr>
              <th scope="col">餐飲類型</th>
              <th scope="col">人數法 k</th>
              <th scope="col">面積法 k</th>
            </tr>
          </thead>
          <tbody>
            {diningOptions.map(([value, label]) => {
              const selected = value === selectedDiningType;
              return (
                <tr
                  aria-current={selected ? "true" : undefined}
                  className={selected ? "reference-selected" : undefined}
                  key={value}
                >
                  <th scope="row">
                    {label}
                    {selected ? (
                      <span className="current-table-badge">目前選用</span>
                    ) : null}
                  </th>
                  <td>{currentDinerFactors[value as CurrentDiningType].k}</td>
                  <td>
                    {currentAreaFactors[value as CurrentDiningType]?.k ??
                      "不適用"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>面積法不適用的餐飲類型會標示為「不適用」。</p>
    </LookupReferenceSection>
  );
}

function withOptional(
  input: Record<string, string>,
  key: string,
  value: string | undefined,
) {
  return value?.trim() ? { ...input, [key]: value } : input;
}

function buildCurrentInput(taskCode: string, values: Record<string, string>) {
  const actualUseMinutes = isCurrentUseTimeOverride(
    taskCode,
    values.diningType,
    values.actualUseMinutes,
  )
    ? values.actualUseMinutes
    : undefined;
  const base = withOptional(
    {
      diningType: values.diningType,
      greaseCleaningDays: values.greaseCleaningDays,
      sedimentCleaningDays: values.sedimentCleaningDays,
      selectionSourceType: "內政部給排水規範（附錄 5）",
    },
    "actualUseMinutes",
    actualUseMinutes,
  );
  const baseWithSelectionNotes = withOptional(
    withOptional(base, "selectionBasis", values.selectionBasis),
    "selectionEvidence",
    values.selectionEvidence,
  );
  if (taskCode === "T05_DESIGN_TO_DINERS_AND_AREA")
    return withOptional(
      {
        kind: "REVERSE",
        ...baseWithSelectionNotes,
        qCapacityLpm: values.qCapacityLpm,
        gCapacityKg: values.gCapacityKg,
        evidenceSource: values.evidenceSource,
      },
      "actualUseMinutes",
      actualUseMinutes,
    );
  if (taskCode === "T03_AREA_TO_FLOW" || taskCode === "T04_AREA_TO_DESIGN")
    return {
      kind: "AREA",
      ...baseWithSelectionNotes,
      kitchenArea: values.kitchenArea,
      diningArea: values.diningArea,
    };
  return { kind: "DINERS", ...baseWithSelectionNotes, people: values.people };
}

function buildSelectionReason(values: Record<string, string>) {
  const parts = [
    values.selectionSourceType ? `來源：${values.selectionSourceType}` : "",
    values.selectionBasis ? `原因：${values.selectionBasis}` : "",
    values.selectionEvidence ? `證據：${values.selectionEvidence}` : "",
  ].filter(Boolean);
  return parts.join("；") || values.selectionReason;
}

function buildLegacyInput(taskCode: string, values: Record<string, string>) {
  if (taskCode === "T06_EFFECTIVE_VOLUME_TO_FLOW")
    return {
      kind: "VOLUME_TO_FLOW",
      effectiveVolumeL: values.effectiveVolumeL,
      evidenceSource: values.evidenceSource,
    };
  const base = {
    qLitersPerPersonMeal: values.qLitersPerPersonMeal,
    operationHours: values.operationHours,
    safetyFactor: values.safetyFactor,
    safetyClass: values.safetyClass,
    selectionReason: buildSelectionReason(values),
    selectionSourceType: values.selectionSourceType,
    selectionBasis: values.selectionBasis,
    selectionEvidence: values.selectionEvidence,
  };
  if (taskCode === "T05_DESIGN_TO_DINERS_AND_AREA")
    return {
      kind: "REVERSE",
      ...base,
      effectiveVolumeL: values.effectiveVolumeL,
      dinerDensity: values.dinerDensity,
      turnover: values.turnover,
    };
  if (taskCode === "T03_AREA_TO_FLOW" || taskCode === "T04_AREA_TO_DESIGN")
    return {
      kind: "AREA",
      ...base,
      areaM2: values.areaM2,
      dinerDensity: values.dinerDensity,
      turnover: values.turnover,
    };
  return {
    kind: "DINERS",
    ...base,
    people: values.people,
    aggregation: "SINGLE_PERIOD",
  };
}

function stringValues(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => typeof value !== "object" && value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}
