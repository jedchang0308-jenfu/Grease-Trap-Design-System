"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { basisForTrack } from "@/domain/rules/source-display";
import { EngineeringOverridePanel } from "@/ui/components/engineering-override-panel";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";
import { StatusBadge } from "@/ui/components/status-badge";
import { fetchJson, UiRequestError } from "@/ui/lib/fetch-json";

interface ReviewCase {
  caseId: string;
  case_no: string;
  revision_no: number;
  title: string;
  customer: string;
  location: string;
  mode: string;
  lifecycle_status: string;
  calculation_status: string;
  calculations: Array<{
    id: string;
    track: string;
    semantics: string;
    raw: Record<string, string>;
    adopted: Record<string, string>;
  }>;
  assessments: Array<{ track: string; status: string; errors: string[] }>;
  overrides: Array<{
    id: string;
    resultPath: string;
    beforeValue: string;
    afterValue: string;
    reason: string;
    evidence: string;
    status: string;
  }>;
}

const checklistItems = [
  ["method", "已確認計算方法與案件任務一致。"],
  ["units", "已確認所有輸入與結果單位。"],
  ["sources", "已確認規則版本、來源與參數選擇。"],
  ["limitations", "已確認報告限制與未執行產品／證書符合性判定。"],
  ["incompleteTracks", "已確認未完成軌標示；若為單軌完成，仍可放行。"],
] as const;

const resultLabels: Record<string, { label: string; unit?: string }> = {
  gKg: { label: "清除週期油脂量 G", unit: "kg" },
  qLpm: { label: "設計處理水量 Q", unit: "L/min" },
  qLph: { label: "設計處理水量 Q", unit: "L/h" },
  effectiveVolumeL: { label: "有效容積 Veff", unit: "L" },
  diners: { label: "等效用餐人數", unit: "人/day" },
  areaM2: { label: "等效營業面積", unit: "m²" },
  basisAreaM2: { label: "採用面積", unit: "m²" },
};

function ResultSummary({
  result,
}: {
  result: ReviewCase["calculations"][number];
}) {
  return (
    <>
      <div className="result-list">
        {Object.entries(result.adopted).map(([key, value]) => {
          const metadata = resultLabels[key] ?? { label: key };
          return (
            <div className="result-item" key={key}>
              <span>{metadata.label}</span>
              <strong>
                {value}
                {metadata.unit ? ` ${metadata.unit}` : ""}
              </strong>
            </div>
          );
        })}
      </div>
      <details>
        <summary>查看高精度原始值與稽核明細</summary>
        <pre className="code-block">
          {JSON.stringify(
            { adopted: result.adopted, raw: result.raw },
            null,
            2,
          )}
        </pre>
      </details>
    </>
  );
}

export function ReviewWorkbench({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [item, setItem] = useState<ReviewCase | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<UiProblem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      setItem(await fetchJson<ReviewCase>(`/api/cases/${caseId}`));
    } catch (error) {
      setProblem(
        error instanceof UiRequestError
          ? error.problem
          : { userMessage: "覆核資料載入未完成，請重試。" },
      );
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const latest = useMemo(() => {
    const results = new Map<string, ReviewCase["calculations"][number]>();
    for (const result of item?.calculations ?? [])
      if (!results.has(result.track)) results.set(result.track, result);
    return [...results.values()];
  }, [item]);

  async function decide(decision: "APPROVED" | "RETURNED") {
    setSubmitting(true);
    setProblem(null);
    try {
      await fetchJson(`/api/cases/${caseId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, checklist: checks, note }),
      });
      router.push(
        decision === "APPROVED"
          ? `/cases/${caseId}/report`
          : `/cases/${caseId}`,
      );
    } catch (error) {
      setProblem(
        error instanceof UiRequestError
          ? error.problem
          : { userMessage: "覆核操作未完成，請重試。" },
      );
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div className="page">
        <div className="state-banner" aria-live="polite">
          正在載入覆核資料，完成後會顯示可執行的下一步。
        </div>
      </div>
    );
  if (problem && !item)
    return (
      <div className="page">
        <RuntimeError problem={problem} onRetry={() => void load()} />
      </div>
    );
  if (!item) return null;

  if (item.lifecycle_status === "REVIEWED") {
    return (
      <div className="page">
        <div className="state-banner">
          <strong>覆核已完成，可以預覽並核發此版本。</strong>
          <div className="button-row" style={{ marginTop: 12 }}>
            <Link className="button primary" href={`/cases/${caseId}/report`}>
              預覽報告
            </Link>
            <Link className="button secondary" href={`/cases/${caseId}`}>
              返回案件
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted" style={{ marginBottom: 5 }}>
            {item.case_no}｜修訂 {item.revision_no}
          </p>
          <h1>工程覆核</h1>
          <p className="lede">
            {item.title.trim() || item.case_no}｜
            {item.customer.trim() || "未填客戶"}
          </p>
        </div>
        <div className="actions">
          <Link href={`/cases/${caseId}`}>返回案件</Link>
        </div>
      </header>
      {problem ? <RuntimeError problem={problem} /> : null}
      <div className="state-banner" style={{ marginBottom: 18 }}>
        <strong>
          送審報告已完成；請針對這份完整報告進行最後一次工程審核。
        </strong>
        <p>系統會分別保存編製、提交、覆核與核發責任事件。</p>
        <div className="button-row" style={{ marginTop: 12 }}>
          <Link className="button secondary" href={`/cases/${caseId}/report`}>
            查看送審報告
          </Link>
        </div>
      </div>

      <section className="panel">
        <div
          className="button-row"
          style={{ justifyContent: "space-between", marginBottom: 16 }}
        >
          <h2 style={{ marginBottom: 0 }}>一頁結論與完成軌</h2>
          <StatusBadge status={item.calculation_status} />
        </div>
        <div className="track-grid">
          {latest.map((result) => (
            <article
              className={`track-panel ${result.track === "LEGACY_QV" ? "legacy" : ""}`}
              key={result.id}
            >
              <h3>
                {result.track === "CURRENT_QG"
                  ? basisForTrack("CURRENT_QG").shortLabel
                  : basisForTrack("LEGACY_QV").shortLabel}
              </h3>
              <p className="muted">{result.semantics}</p>
              <ResultSummary result={result} />
            </article>
          ))}
        </div>
        <p className="help" style={{ marginTop: 16 }}>
          本報告只處理設計需求計算，未執行特定產品或證書符合性判定。
        </p>
      </section>

      <EngineeringOverridePanel
        caseId={caseId}
        existing={item.overrides ?? []}
        editable={false}
      />

      <section className="panel">
        <h2>具名覆核清單</h2>
        <div className="checklist">
          {checklistItems.map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={checks[key] === true}
                onChange={(event) =>
                  setChecks((previous) => ({
                    ...previous,
                    [key]: event.target.checked,
                  }))
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="review-note">覆核或退回說明</label>
          <textarea
            id="review-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="退回修正時必填；完成覆核可補充工程判斷"
          />
        </div>
        <div className="button-row end" style={{ marginTop: 18 }}>
          <button
            className="button danger"
            type="button"
            disabled={submitting}
            onClick={() => void decide("RETURNED")}
          >
            退回修正
          </button>
          <button
            className="button primary"
            type="button"
            disabled={submitting}
            onClick={() => void decide("APPROVED")}
          >
            {submitting ? "正在處理…" : "完成覆核"}
          </button>
        </div>
      </section>
    </div>
  );
}
