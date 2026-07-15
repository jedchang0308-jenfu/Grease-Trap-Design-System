"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  calculationBasisDisplay,
  calculationModeDisplay,
} from "@/domain/rules/source-display";
import { DesignResultsTable } from "@/ui/components/design-results-table";
import {
  FieldLabelHelp,
  type FieldHelpContent,
} from "@/ui/components/field-help";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";
import { StatusBadge } from "@/ui/components/status-badge";
import { fetchJson, UiRequestError } from "@/ui/lib/fetch-json";

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

interface CalculationResponse {
  status: string;
  releaseEligible: boolean;
  caseVersion: number;
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

const taskLabels: Record<string, string> = {
  T01_DINERS_TO_FLOW: "人數換算流量",
  T02_DINERS_TO_DESIGN: "人數規劃設計需求",
  T03_AREA_TO_FLOW: "面積換算流量",
  T04_AREA_TO_DESIGN: "面積規劃設計需求",
  T05_DESIGN_TO_DINERS_AND_AREA: "設備能力反推人數及面積",
};

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
    note: "內政部給排水規範（附錄 5）的面積計算必須同時提供廚房面積與用餐區面積。",
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
  greaseDays: {
    description: "填寫兩次完整清除油脂之間的天數；本計算依據允許 7～14 day。",
    note: "清除間隔越長，所需油脂容量通常越大。",
  },
  sedimentDays: {
    description: "填寫兩次完整清除殘渣之間的天數；本計算依據允許 7～30 day。",
    note: "請依案件預定的實際維護週期填寫。",
  },
  legacyPeople: {
    description:
      "填寫單一餐期的用餐人數，單位為人/餐；系統依臺北市工務局衛工處設計說明計算設計需求。",
    note: "這裡不是填每日總用餐人數。",
  },
  legacyArea: {
    description:
      "填寫臺北市工務局衛工處設計說明的面積計算所需用餐營業面積，單位為 m²。",
    note: "系統會搭配人員密度與翻桌率，換算單一餐期的用餐人數。",
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
      "填寫油脂截留器可實際使用的有效容積，單位為 L；系統會用來反推等效人數與面積。",
    note: "請勿填外殼的名目容積。",
  },
  legacyQ: {
    description: "填寫每人每餐用水量 q，單位為 L/(人·餐)。優先採用實測值。",
    note: "沒有實測時，須從來源提供的範圍選定明確數值，不可直接取範圍平均。",
  },
  legacyHours: {
    description: "填寫該餐期或連續操作的有效操作時間 t，單位為 h。",
    note: "系統會以用餐人數、每人每餐用水量與操作時間計算每小時流量。",
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
    description:
      "說明 q、餐飲類別與 exact k 的選用依據，供後續工程覆核與追溯。",
    note: "例如：餐飲型態、來源表格、實測紀錄或工程判斷。",
  },
} satisfies Record<string, FieldHelpContent>;

export function CaseWorkbench({ caseId }: { caseId: string }) {
  const [item, setItem] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
  });
  const [legacy, setLegacy] = useState<Record<string, string>>({
    people: "100",
    qLitersPerPersonMeal: "30",
    operationHours: "5",
    safetyFactor: "1.5",
    safetyClass: "A",
    selectionReason: "依來源餐飲分類選用",
    areaM2: "200",
    dinerDensity: "0.5",
    turnover: "5",
    effectiveVolumeL: "500",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      const data = await fetchJson<CaseDetail>(`/api/cases/${caseId}`);
      setItem(data);
      const storedCurrent = data.input_payload?.currentInputs;
      const storedLegacy = data.input_payload?.legacyInputs;
      if (storedCurrent)
        setCurrent((previous) => ({
          ...previous,
          ...stringValues(storedCurrent),
        }));
      else if (data.dining_type) {
        const diningType = data.dining_type;
        setCurrent((previous) => ({
          ...previous,
          diningType,
        }));
      }
      if (storedLegacy)
        setLegacy((previous) => ({
          ...previous,
          ...stringValues(storedLegacy),
        }));
    } catch (error) {
      setProblem(
        error instanceof UiRequestError
          ? error.problem
          : { userMessage: "案件載入未完成，請重試。" },
      );
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
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
      Object.values(latestResults).filter((result): result is PersistedResult =>
        Boolean(result),
      ),
    [latestResults],
  );

  async function calculate(event: FormEvent) {
    event.preventDefault();
    if (!item) return;
    setSubmitting(true);
    setProblem(null);
    try {
      await fetchJson<CalculationResponse>(`/api/cases/${caseId}/calculate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      await load();
    } catch (error) {
      setProblem(
        error instanceof UiRequestError
          ? error.problem
          : { userMessage: "目前未完成這次計算，已填資料仍保留。請重試。" },
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="state-banner" aria-live="polite">
          正在載入案件，完成後會顯示可執行的下一步。
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

  const readonly = ["IN_REVIEW", "REVIEWED", "ISSUED", "SUPERSEDED"].includes(
    item.lifecycle_status,
  );
  const currentEnabled = item.mode !== "LEGACY_QV";
  const legacyEnabled = item.mode !== "CURRENT_QG";
  const displayTitle = item.title.trim() || item.case_no;
  const displayCustomer = item.customer.trim() || "未填客戶";
  const displayLocation = item.location.trim() || "未填地點";

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted" style={{ marginBottom: 5 }}>
            {item.case_no}｜修訂 {item.revision_no}
          </p>
          <h1>{displayTitle}</h1>
          <p className="lede">
            {displayCustomer}｜{displayLocation}
          </p>
        </div>
        <div className="actions">
          <Link href="/cases">返回案件清單</Link>
        </div>
      </header>

      {problem ? (
        <RuntimeError problem={problem} onRetry={() => void load()} />
      ) : null}

      <section className="panel stack" aria-label="案件狀態與下一步">
        <dl className="summary-grid">
          <div>
            <dt>任務</dt>
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
          <div>
            <dt>案件狀態</dt>
            <dd>
              <StatusBadge status={item.lifecycle_status} />
            </dd>
          </div>
        </dl>
        <NextAction item={item} />
      </section>

      <form className="stack" onSubmit={calculate}>
        <section className="panel">
          <div className="page-header" style={{ marginBottom: 16 }}>
            <div>
              <h2>計算資料</h2>
              <p className="lede">
                欄位依任務與模式顯示；每個數值旁都保留單位語意。
              </p>
            </div>
            {!readonly ? (
              <button
                className="button primary"
                type="submit"
                disabled={submitting}
              >
                {submitting
                  ? "正在計算…"
                  : item.calculation_status
                    ? "重新計算"
                    : "開始計算"}
              </button>
            ) : null}
          </div>
          <div className="track-grid">
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
                />
              </fieldset>
            ) : null}
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
                />
              </fieldset>
            ) : null}
          </div>
          <p className="help" style={{ marginTop: 16, marginBottom: 0 }}>
            本系統未執行特定產品或證書符合性判定。
          </p>
        </section>

        {item.calculation_status || item.assessments.length > 0 ? (
          <section className="panel">
            <h2>本次設計結果</h2>
            {item.calculation_status === "COMPLETE_WITH_REMINDER" ? (
              <div
                className="state-banner warning"
                style={{ marginBottom: 16 }}
              >
                <strong>可完成報告草稿：已有一軌完成。</strong>
                <p>另一軌未計算，不影響本次放行；你仍可補齊後重新計算。</p>
              </div>
            ) : null}
            {item.calculation_status === "BLOCKED" ? (
              <div className="state-banner danger" style={{ marginBottom: 16 }}>
                <strong>目前無法計算：選定模式沒有有效結果。</strong>
                <p>雙軌案件請先補齊任一軌，再重新計算。</p>
              </div>
            ) : null}
            <DesignResultsTable mode={item.mode} runs={designResultRuns} />
          </section>
        ) : null}
      </form>
    </div>
  );
}

function NextAction({ item }: { item: CaseDetail }) {
  if (
    item.lifecycle_status === "CALCULATED" &&
    ["COMPLETE", "COMPLETE_WITH_REMINDER"].includes(
      item.calculation_status ?? "",
    )
  ) {
    return (
      <div
        className={
          item.calculation_status === "COMPLETE_WITH_REMINDER"
            ? "state-banner warning"
            : "state-banner"
        }
      >
        <strong>
          {item.calculation_status === "COMPLETE_WITH_REMINDER"
            ? "已有一軌完成；先完成報告草稿，另一軌未計算不影響放行。"
            : "計算已完成；下一步先完成報告草稿。"}
        </strong>
        <div className="button-row" style={{ marginTop: 12 }}>
          <Link
            className="button primary"
            href={`/cases/${item.caseId}/report`}
          >
            完成報告草稿
          </Link>
        </div>
      </div>
    );
  }
  if (item.lifecycle_status === "IN_REVIEW") {
    return (
      <div className="state-banner">
        <strong>送審報告已完成；現在進行最後一次工程審核。</strong>
        <div className="button-row" style={{ marginTop: 12 }}>
          <Link
            className="button primary"
            href={`/cases/${item.caseId}/review`}
          >
            開始最終審核
          </Link>
        </div>
      </div>
    );
  }
  if (item.lifecycle_status === "REVIEWED") {
    return (
      <div className="state-banner">
        <strong>最終覆核已完成，可以預覽並核發此版本。</strong>
        <div className="button-row" style={{ marginTop: 12 }}>
          <Link
            className="button primary"
            href={`/cases/${item.caseId}/report`}
          >
            預覽報告
          </Link>
        </div>
      </div>
    );
  }
  if (item.lifecycle_status === "ISSUED") {
    const report = item.reports.find((value) => value.status === "ISSUED");
    return (
      <div className="state-banner">
        <strong>
          此版本已正式核發，不需再次核發。若內容要改，請建立新修訂版。
        </strong>
        <div className="button-row" style={{ marginTop: 12 }}>
          {report ? (
            <a
              className="button primary"
              href={`/api/reports/${report.id}/download`}
            >
              下載已核發報告
            </a>
          ) : null}
          <Link
            className="button secondary"
            href={`/cases/${item.caseId}/report`}
          >
            查看報告紀錄
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="state-banner">
      <strong>先填完任一可用軌的必要資料，即可開始計算。</strong>
    </div>
  );
}

function CurrentFields({ taskCode, values, setValues }: FieldProps) {
  const set = (key: string, value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));
  const reverse = taskCode === "T05_DESIGN_TO_DINERS_AND_AREA";
  const area =
    taskCode === "T03_AREA_TO_FLOW" || taskCode === "T04_AREA_TO_DESIGN";
  return (
    <div className="form-grid" style={{ marginTop: 12 }}>
      <div className="field span-2">
        <FieldLabelHelp
          htmlFor="current-dining"
          label="餐飲類型"
          help={fieldHelp.diningType}
        />
        <select
          id="current-dining"
          required
          value={values.diningType}
          onChange={(event) => set("diningType", event.target.value)}
        >
          <option value="" disabled>
            請選擇餐飲類型
          </option>
          {diningOptions.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {!area && !reverse ? (
        <NumberField
          id="current-people"
          label="每日用餐人數"
          unit="人/day"
          help={fieldHelp.currentPeople}
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
            value={values.kitchenArea}
            onChange={(value) => set("kitchenArea", value)}
          />
          <NumberField
            id="dining-area"
            label="用餐區面積"
            unit="m²"
            help={fieldHelp.currentDiningArea}
            value={values.diningArea}
            onChange={(value) => set("diningArea", value)}
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
            value={values.qCapacityLpm}
            onChange={(value) => set("qCapacityLpm", value)}
          />
          <NumberField
            id="g-capacity"
            label="G 設計能力"
            unit="kg"
            help={fieldHelp.gCapacity}
            value={values.gCapacityKg}
            onChange={(value) => set("gCapacityKg", value)}
          />
          <div className="field span-2">
            <FieldLabelHelp
              htmlFor="capacity-source"
              label="能力資料來源／證據"
              help={fieldHelp.capacitySource}
            />
            <input
              id="capacity-source"
              required
              value={values.evidenceSource}
              onChange={(event) => set("evidenceSource", event.target.value)}
            />
          </div>
        </>
      ) : null}
      <NumberField
        id="grease-days"
        label="油脂清除週期"
        unit="day"
        help={fieldHelp.greaseDays}
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
        min="7"
        max="30"
        value={values.sedimentCleaningDays}
        onChange={(value) => set("sedimentCleaningDays", value)}
      />
    </div>
  );
}

function LegacyFields({ taskCode, values, setValues }: FieldProps) {
  const set = (key: string, value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));
  const reverse = taskCode === "T05_DESIGN_TO_DINERS_AND_AREA";
  const area =
    taskCode === "T03_AREA_TO_FLOW" || taskCode === "T04_AREA_TO_DESIGN";
  return (
    <div className="form-grid" style={{ marginTop: 12 }}>
      {!area && !reverse ? (
        <NumberField
          id="legacy-people"
          label="用餐人數"
          unit="人/餐"
          help={fieldHelp.legacyPeople}
          value={values.people}
          onChange={(value) => set("people", value)}
        />
      ) : null}
      {area ? (
        <>
          <NumberField
            id="legacy-area"
            label="用餐區面積"
            unit="m²"
            help={fieldHelp.legacyArea}
            value={values.areaM2}
            onChange={(value) => set("areaM2", value)}
          />
          <NumberField
            id="legacy-density"
            label="人員密度"
            unit="人/m²"
            help={fieldHelp.legacyDensity}
            value={values.dinerDensity}
            onChange={(value) => set("dinerDensity", value)}
          />
          <NumberField
            id="legacy-turnover"
            label="翻桌率"
            unit="次"
            help={fieldHelp.legacyTurnover}
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
            value={values.effectiveVolumeL}
            onChange={(value) => set("effectiveVolumeL", value)}
          />
          <NumberField
            id="legacy-density-rev"
            label="人員密度"
            unit="人/m²"
            help={fieldHelp.legacyDensity}
            value={values.dinerDensity}
            onChange={(value) => set("dinerDensity", value)}
          />
          <NumberField
            id="legacy-turnover-rev"
            label="翻桌率"
            unit="次"
            help={fieldHelp.legacyTurnover}
            value={values.turnover}
            onChange={(value) => set("turnover", value)}
          />
        </>
      ) : null}
      <NumberField
        id="legacy-q"
        label="每人每餐用水量 q"
        unit="L/(人·餐)"
        help={fieldHelp.legacyQ}
        value={values.qLitersPerPersonMeal}
        onChange={(value) => set("qLitersPerPersonMeal", value)}
      />
      <NumberField
        id="legacy-hours"
        label="操作時間 t"
        unit="h"
        help={fieldHelp.legacyHours}
        value={values.operationHours}
        onChange={(value) => set("operationHours", value)}
      />
      <div className="field">
        <FieldLabelHelp
          htmlFor="safety-class"
          label="安全係數類別"
          help={fieldHelp.safetyClass}
        />
        <select
          id="safety-class"
          value={values.safetyClass}
          onChange={(event) => {
            const safetyClass = event.target.value;
            setValues((previous) => ({
              ...previous,
              safetyClass,
              safetyFactor:
                safetyClass === "A"
                  ? "1.5"
                  : safetyClass === "B"
                    ? "1.3"
                    : "1.2",
            }));
          }}
        >
          <option value="A">A 類</option>
          <option value="B">B 類</option>
          <option value="C">C 類</option>
        </select>
      </div>
      <NumberField
        id="legacy-k"
        label="exact k"
        unit="ratio"
        help={fieldHelp.legacyK}
        value={values.safetyFactor}
        onChange={(value) => set("safetyFactor", value)}
      />
      <div className="field span-2">
        <FieldLabelHelp
          htmlFor="legacy-reason"
          label="參數選擇理由"
          help={fieldHelp.legacyReason}
        />
        <input
          id="legacy-reason"
          required
          value={values.selectionReason}
          onChange={(event) => set("selectionReason", event.target.value)}
        />
      </div>
    </div>
  );
}

interface FieldProps {
  taskCode: string;
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

function NumberField({
  id,
  label,
  unit,
  help,
  value,
  onChange,
  min = "0.000001",
  max,
}: {
  id: string;
  label: string;
  unit: string;
  help: FieldHelpContent;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <div className="field">
      <FieldLabelHelp htmlFor={id} label={`${label}（${unit}）`} help={help} />
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
    </div>
  );
}

function buildCurrentInput(taskCode: string, values: Record<string, string>) {
  const base = {
    diningType: values.diningType,
    greaseCleaningDays: values.greaseCleaningDays,
    sedimentCleaningDays: values.sedimentCleaningDays,
  };
  if (taskCode === "T05_DESIGN_TO_DINERS_AND_AREA")
    return {
      kind: "REVERSE",
      ...base,
      qCapacityLpm: values.qCapacityLpm,
      gCapacityKg: values.gCapacityKg,
      evidenceSource: values.evidenceSource,
    };
  if (taskCode === "T03_AREA_TO_FLOW" || taskCode === "T04_AREA_TO_DESIGN")
    return {
      kind: "AREA",
      ...base,
      kitchenArea: values.kitchenArea,
      diningArea: values.diningArea,
    };
  return { kind: "DINERS", ...base, people: values.people };
}

function buildLegacyInput(taskCode: string, values: Record<string, string>) {
  const base = {
    qLitersPerPersonMeal: values.qLitersPerPersonMeal,
    operationHours: values.operationHours,
    safetyFactor: values.safetyFactor,
    safetyClass: values.safetyClass,
    selectionReason: values.selectionReason,
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
