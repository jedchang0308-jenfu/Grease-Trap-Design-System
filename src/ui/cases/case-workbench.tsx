import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { calculateCase } from "@/application/cases/calculation-service";
import { createRevision } from "@/application/cases/revision-service";
import {
  deleteCaseGroup,
  getLatestCase,
  presentCase,
} from "@/application/cases/repository";
import { toProblem } from "@/application/problem";
import {
  calculationBasisDisplay,
  calculationModeDisplay,
  calculationTrackOrder,
} from "@/domain/rules/source-display";
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

type CurrentDiningType = (typeof diningOptions)[number][0];

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
    description:
      "填寫顧客座席與實際用餐區面積，單位為 m²，不包含廚房作業區。這是兩種算法共用的案件資料。",
    note: "任一算法的共用面積修改後，另一算法會同步更新；算法 B 會再與廚房面積相加。",
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
      "填寫顧客座席與實際用餐營業區面積，單位為 m²，不包含廚房作業區。這是兩種算法共用的案件資料。",
    note: "任一算法的共用面積修改後，另一算法會同步更新；算法 A 會搭配人員密度與翻桌率換算用餐人數。",
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
    note: "A 類為 1.5；B、C 類各有兩個可用 k，仍須人工確認 exact k。",
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
    description: "用一句話說明為什麼採用這組 q、分類與 exact k。",
    note: "避免只寫「依來源選用」；請補上餐飲型態或保守性判斷。",
  },
  selectionEvidence: {
    description: "填寫文件名稱、頁次、實測紀錄或客戶確認紀錄。",
    note: "若目前沒有正式附件，可先填口頭確認或資料提供者。",
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
  });
  const [legacy, setLegacy] = useState<Record<string, string>>({
    people: "100",
    qLitersPerPersonMeal: "30",
    operationHours: "5",
    safetyFactor: "1.5",
    safetyClass: "A",
    selectionReason: "依來源餐飲分類選用",
    selectionSourceType: "來源表範圍選值",
    selectionBasis: "依餐飲型態與來源分類選用",
    selectionEvidence: "",
    areaM2: "150",
    dinerDensity: "0.5",
    turnover: "5",
    effectiveVolumeL: "500",
    evidenceSource: "製造商提供設備有效容積資料",
  });

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
      const sharedDiningArea =
        storedCurrentValues?.diningArea ?? storedLegacyValues?.areaM2;
      if (
        storedCurrentValues ||
        sharedDiningArea !== undefined ||
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
          ...(sharedDiningArea !== undefined
            ? { diningArea: sharedDiningArea }
            : {}),
        }));
      if (storedLegacyValues || sharedDiningArea !== undefined)
        setLegacy((previous) => ({
          ...previous,
          ...(storedLegacyValues ?? {}),
          ...(sharedDiningArea !== undefined
            ? { areaM2: sharedDiningArea }
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
  return (
    <InputMatrix>
      <SelectField
        id="current-dining"
        label="餐飲類型"
        help={fieldHelp.diningType}
        sourceType="工程選值"
        value={values.diningType}
        onChange={(value) => set("diningType", value)}
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
        <CurrentUseTimeSourceTable diningType={values.diningType} />
      </details>
    </InputMatrix>
  );
}

function CurrentUseTimeSourceTable({ diningType }: { diningType: string }) {
  const selectedDiningType = isDiningType(diningType) ? diningType : null;
  return (
    <details className="field-reference current-t-source-table" open>
      <summary>內政部每日使用時間 t 來源表</summary>
      <div className="reference-table-wrap">
        <table className="reference-table current-t-table">
          <thead>
            <tr>
              <th>餐飲類型</th>
              <th>人數法 A-37 t</th>
              <th>面積法 A-34～A-36 t</th>
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
                  <td data-label="人數法 A-37 t">
                    {currentDinerUseMinutes[value]} min/day
                  </td>
                  <td data-label="面積法 A-34～A-36 t">
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
    </details>
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

function buildCurrentUseTimeReference(taskCode: string, diningType: string) {
  if (!isDiningType(diningType)) return null;
  const reverse = taskCode === "T05_DESIGN_TO_DINERS_AND_AREA";
  const diners =
    taskCode === "T01_DINERS_TO_FLOW" || taskCode === "T02_DINERS_TO_DESIGN";
  const area =
    taskCode === "T03_AREA_TO_FLOW" || taskCode === "T04_AREA_TO_DESIGN";
  if (!diners && !area && !reverse) return null;
  const lines: string[] = [];

  if (diners || reverse) {
    lines.push(`人數法 A-37：t=${currentDinerUseMinutes[diningType]} min/day`);
  }

  if (area || reverse) {
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
  const reverse = taskCode === "T05_DESIGN_TO_DINERS_AND_AREA";
  const diners =
    taskCode === "T01_DINERS_TO_FLOW" || taskCode === "T02_DINERS_TO_DESIGN";
  const area =
    taskCode === "T03_AREA_TO_FLOW" || taskCode === "T04_AREA_TO_DESIGN";
  if (!diners && !area && !reverse) return null;

  if (reverse) {
    const dinerValue = currentDinerUseMinutes[diningType];
    const areaValue = currentAreaUseMinutes[diningType];
    return areaValue && dinerValue === areaValue ? dinerValue : null;
  }

  return area
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
          />
          <NumberField
            id="legacy-turnover"
            label="翻桌率"
            unit="次"
            help={fieldHelp.legacyTurnover}
            sourceType="工程選值"
            value={values.turnover}
            onChange={(value) => set("turnover", value)}
          />
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
          />
          <NumberField
            id="legacy-turnover-rev"
            label="翻桌率"
            unit="次"
            help={fieldHelp.legacyTurnover}
            sourceType="工程選值"
            value={values.turnover}
            onChange={(value) => set("turnover", value)}
          />
        </>
      ) : null}
      <NumberField
        id="legacy-q"
        label="每人每餐用水量 q"
        detailLabel="q 參考表"
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
      />
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
        label="選值原因"
        help={fieldHelp.selectionBasis}
        sourceType="工程選值"
        value={values.selectionBasis}
        onChange={(value) => set("selectionBasis", value)}
        required
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
  detailLabel,
}: {
  id: string;
  label: string;
  detailLabel?: string;
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
    <>
      <InputMatrixRow id={id} label={label} help={help} sourceType={sourceType}>
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
      {children ? (
        <InputMatrixDetail
          label={detailLabel ?? `${label}參考`}
          sourceType={sourceType}
        >
          {children}
        </InputMatrixDetail>
      ) : null}
    </>
  );
}

function OptionalNumberField({
  id,
  label,
  unit,
  help,
  sourceType,
  value,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  help: FieldHelpContent;
  sourceType: VisibleInputSourceType;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <InputMatrixRow id={id} label={label} help={help} sourceType={sourceType}>
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
}: {
  id: string;
  label: string;
  help: FieldHelpContent;
  sourceType: VisibleInputSourceType;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <InputMatrixRow id={id} label={label} help={help} sourceType={sourceType}>
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
  children,
}: {
  id: string;
  label: string;
  help: FieldHelpContent;
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

function LegacyWaterReference() {
  return (
    <details className="field-reference">
      <summary>臺北市用水量參考表</summary>
      <div className="reference-table-wrap">
        <table className="reference-table">
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
        value，並於選值原因留下依據。
      </p>
    </details>
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
    },
    "actualUseMinutes",
    actualUseMinutes,
  );
  if (taskCode === "T05_DESIGN_TO_DINERS_AND_AREA")
    return withOptional(
      {
        kind: "REVERSE",
        ...base,
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
      ...base,
      kitchenArea: values.kitchenArea,
      diningArea: values.diningArea,
    };
  return { kind: "DINERS", ...base, people: values.people };
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
