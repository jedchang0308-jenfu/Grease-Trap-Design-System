"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  dining_type: string;
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

const resultLabels: Record<string, string> = {
  qLpm: "流量 Q（L/min）",
  gKg: "油脂量 G（kg）",
  qLph: "流量 Q（L/h）",
  effectiveVolumeL: "有效容積 Veff（L）",
  dinersEquivalentMax: "等效人數上限（人）",
  areaEquivalentMaxM2: "等效面積上限（m²）",
  totalAreaM2: "全面積（m²）",
  n0: "補正餐位利用率 n0",
};

const taskLabels: Record<string, string> = {
  T01_DINERS_TO_FLOW: "人數換算流量",
  T02_DINERS_TO_DESIGN: "人數規劃設計需求",
  T03_AREA_TO_FLOW: "面積換算流量",
  T04_AREA_TO_DESIGN: "面積規劃設計需求",
  T05_DESIGN_TO_DINERS_AND_AREA: "設備能力反推人數及面積",
};

export function CaseWorkbench({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [item, setItem] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<UiProblem | null>(null);
  const [current, setCurrent] = useState<Record<string, string>>({
    diningType: "CHINESE",
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
      else if (data.dining_type)
        setCurrent((previous) => ({
          ...previous,
          diningType: data.dining_type,
        }));
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

  const latestAssessments = useMemo(() => {
    const map: Partial<Record<"CURRENT_QG" | "LEGACY_QV", Assessment>> = {};
    for (const assessment of item?.assessments ?? [])
      if (!map[assessment.track]) map[assessment.track] = assessment;
    return map;
  }, [item]);

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

  async function submitReview() {
    setSubmitting(true);
    setProblem(null);
    try {
      await fetchJson(`/api/cases/${caseId}/submit-review`, { method: "POST" });
      router.push(`/cases/${caseId}/review`);
    } catch (error) {
      setProblem(
        error instanceof UiRequestError
          ? error.problem
          : { userMessage: "案件尚未進入覆核，請重試。" },
      );
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

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted" style={{ marginBottom: 5 }}>
            {item.case_no}｜修訂 {item.revision_no}
          </p>
          <h1>{item.title}</h1>
          <p className="lede">
            {item.customer}｜{item.location}
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
                ? "現行 Q/G"
                : item.mode === "LEGACY_QV"
                  ? "舊版 Q/V"
                  : "新舊雙軌"}
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
        <NextAction
          item={item}
          submitting={submitting}
          onReview={() => void submitReview()}
        />
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
                <legend className="legend-label">現行 Q/G</legend>
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
                  舊版 Q/V（歷史指引方法）
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
            <h2>計算結果</h2>
            {item.calculation_status === "COMPLETE_WITH_REMINDER" ? (
              <div
                className="state-banner warning"
                style={{ marginBottom: 16 }}
              >
                <strong>可繼續覆核：已有一軌完成。</strong>
                <p>另一軌未計算，不影響本次放行；你仍可補齊後重新計算。</p>
              </div>
            ) : null}
            {item.calculation_status === "BLOCKED" ? (
              <div className="state-banner danger" style={{ marginBottom: 16 }}>
                <strong>目前無法計算：選定模式沒有有效結果。</strong>
                <p>雙軌案件請先補齊任一軌，再重新計算。</p>
              </div>
            ) : null}
            <div className="track-grid">
              {currentEnabled ? (
                <TrackResult
                  track="CURRENT_QG"
                  result={latestResults.CURRENT_QG}
                  assessment={latestAssessments.CURRENT_QG}
                />
              ) : null}
              {legacyEnabled ? (
                <TrackResult
                  track="LEGACY_QV"
                  result={latestResults.LEGACY_QV}
                  assessment={latestAssessments.LEGACY_QV}
                />
              ) : null}
            </div>
          </section>
        ) : null}
      </form>
    </div>
  );
}

function NextAction({
  item,
  submitting,
  onReview,
}: {
  item: CaseDetail;
  submitting: boolean;
  onReview: () => void;
}) {
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
            ? "可繼續覆核：已有一軌完成，另一軌未計算不影響放行。"
            : "計算已完成；下一步由你進行工程覆核。"}
        </strong>
        <div className="button-row" style={{ marginTop: 12 }}>
          <button
            className="button primary"
            type="button"
            onClick={onReview}
            disabled={submitting}
          >
            {submitting
              ? "正在提交…"
              : item.calculation_status === "COMPLETE_WITH_REMINDER"
                ? "繼續覆核"
                : "開始覆核"}
          </button>
        </div>
      </div>
    );
  }
  if (item.lifecycle_status === "IN_REVIEW") {
    return (
      <div className="state-banner">
        <strong>
          案件已進入覆核；你可以直接繼續，不需切換帳號或等待他人。
        </strong>
        <div className="button-row" style={{ marginTop: 12 }}>
          <Link
            className="button primary"
            href={`/cases/${item.caseId}/review`}
          >
            繼續覆核
          </Link>
        </div>
      </div>
    );
  }
  if (item.lifecycle_status === "REVIEWED") {
    return (
      <div className="state-banner">
        <strong>覆核已完成，可以預覽並核發此版本。</strong>
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
        <label htmlFor="current-dining">餐飲類型</label>
        <select
          id="current-dining"
          value={values.diningType}
          onChange={(event) => set("diningType", event.target.value)}
        >
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
            value={values.kitchenArea}
            onChange={(value) => set("kitchenArea", value)}
          />
          <NumberField
            id="dining-area"
            label="用餐區面積"
            unit="m²"
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
            value={values.qCapacityLpm}
            onChange={(value) => set("qCapacityLpm", value)}
          />
          <NumberField
            id="g-capacity"
            label="G 設計能力"
            unit="kg"
            value={values.gCapacityKg}
            onChange={(value) => set("gCapacityKg", value)}
          />
          <div className="field span-2">
            <label htmlFor="capacity-source">能力資料來源／證據</label>
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
        min="7"
        max="14"
        value={values.greaseCleaningDays}
        onChange={(value) => set("greaseCleaningDays", value)}
      />
      <NumberField
        id="sediment-days"
        label="殘渣清除週期"
        unit="day"
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
            value={values.areaM2}
            onChange={(value) => set("areaM2", value)}
          />
          <NumberField
            id="legacy-density"
            label="人員密度"
            unit="人/m²"
            value={values.dinerDensity}
            onChange={(value) => set("dinerDensity", value)}
          />
          <NumberField
            id="legacy-turnover"
            label="翻桌率"
            unit="次"
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
            value={values.effectiveVolumeL}
            onChange={(value) => set("effectiveVolumeL", value)}
          />
          <NumberField
            id="legacy-density-rev"
            label="人員密度"
            unit="人/m²"
            value={values.dinerDensity}
            onChange={(value) => set("dinerDensity", value)}
          />
          <NumberField
            id="legacy-turnover-rev"
            label="翻桌率"
            unit="次"
            value={values.turnover}
            onChange={(value) => set("turnover", value)}
          />
        </>
      ) : null}
      <NumberField
        id="legacy-q"
        label="每人每餐用水量 q"
        unit="L/(人·餐)"
        value={values.qLitersPerPersonMeal}
        onChange={(value) => set("qLitersPerPersonMeal", value)}
      />
      <NumberField
        id="legacy-hours"
        label="操作時間 t"
        unit="h"
        value={values.operationHours}
        onChange={(value) => set("operationHours", value)}
      />
      <div className="field">
        <label htmlFor="safety-class">安全係數類別</label>
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
        value={values.safetyFactor}
        onChange={(value) => set("safetyFactor", value)}
      />
      <div className="field span-2">
        <label htmlFor="legacy-reason">參數選擇理由</label>
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
  value,
  onChange,
  min = "0.000001",
  max,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}（{unit}）
      </label>
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

function TrackResult({
  track,
  result,
  assessment,
}: {
  track: "CURRENT_QG" | "LEGACY_QV";
  result?: PersistedResult;
  assessment?: Assessment;
}) {
  return (
    <article className={`track-panel ${track === "LEGACY_QV" ? "legacy" : ""}`}>
      <div className="button-row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ marginBottom: 0 }}>
          {track === "CURRENT_QG" ? "現行 Q/G" : "舊版 Q/V"}
        </h3>
        <StatusBadge status={result ? "CALCULATED" : assessment?.status} />
      </div>
      {result ? (
        <>
          <p className="muted" style={{ marginTop: 10 }}>
            {result.semantics}
          </p>
          <div className="result-list">
            {Object.entries(result.adopted)
              .filter(([, value]) => value !== null)
              .map(([key, value]) => (
                <div className="result-item" key={key}>
                  <span>{resultLabels[key] ?? key}</span>
                  <strong>{value}</strong>
                </div>
              ))}
          </div>
          <details>
            <summary>查看計算結果明細</summary>
            <pre className="code-block">
              {JSON.stringify(
                {
                  raw: result.raw,
                  adopted: result.adopted,
                  methodCode: result.methodCode,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </>
      ) : (
        <div className="state-banner warning" style={{ marginTop: 12 }}>
          <strong>未計算</strong>
          <p>
            {assessment?.errors?.[0] ??
              assessment?.releaseRelevance ??
              "請補齊此軌必要資料後重新計算。"}
          </p>
        </div>
      )}
    </article>
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
