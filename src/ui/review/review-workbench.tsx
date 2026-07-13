"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  gKg: { label: "油脂量 G", unit: "kg" },
  qLpm: { label: "流量 Q", unit: "L/min" },
  qLph: { label: "流量 Q", unit: "L/h" },
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
            {item.title}｜{item.customer}
          </p>
        </div>
        <div className="actions">
          <Link href={`/cases/${caseId}`}>返回案件</Link>
        </div>
      </header>
      {problem ? <RuntimeError problem={problem} /> : null}
      <div className="state-banner" style={{ marginBottom: 18 }}>
        <strong>
          案件已進入覆核；你可以直接繼續，不需切換帳號或等待他人。
        </strong>
        <p>系統會分別保存編製、提交、覆核與核發責任事件。</p>
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
                  ? "現行 Q/G"
                  : "舊版 Q/V（歷史方法）"}
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

      <OverridePanel
        caseId={caseId}
        existing={item.overrides ?? []}
        onCreated={() => void load()}
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

function OverridePanel({
  caseId,
  existing,
  onCreated,
}: {
  caseId: string;
  existing: ReviewCase["overrides"];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<UiProblem | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setProblem(null);
    const form = new FormData(event.currentTarget);
    try {
      await fetchJson(`/api/cases/${caseId}/overrides`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      setOpen(false);
      onCreated();
    } catch (error) {
      setProblem(
        error instanceof UiRequestError
          ? error.problem
          : { userMessage: "人工採用紀錄未建立，請重試。" },
      );
      setSubmitting(false);
    }
  }
  return (
    <section className="panel">
      <div
        className="page-header"
        style={{ marginBottom: existing.length || open ? 16 : 0 }}
      >
        <div>
          <h2>人工採用與例外</h2>
          <p className="lede">
            只有正式採用值與 raw 結果不同時才建立，並保存前後值、理由與依據。
          </p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "取消" : "建立人工採用"}
          </button>
        </div>
      </div>
      {problem ? <RuntimeError problem={problem} /> : null}
      {existing.map((item) => (
        <div
          className="state-banner warning"
          key={item.id}
          style={{ marginBottom: 10 }}
        >
          <strong>
            {item.resultPath}：{String(item.beforeValue)} →{" "}
            {String(item.afterValue)}
          </strong>
          <p>
            {item.reason}｜依據：{item.evidence}
          </p>
        </div>
      ))}
      {open ? (
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="override-path">結果路徑</label>
              <input
                id="override-path"
                name="resultPath"
                required
                placeholder="例如 CURRENT_QG.adopted.qLpm"
              />
            </div>
            <div className="field">
              <label htmlFor="before-value">原採用值</label>
              <input id="before-value" name="beforeValue" required />
            </div>
            <div className="field">
              <label htmlFor="after-value">新採用值</label>
              <input id="after-value" name="afterValue" required />
            </div>
            <div className="field span-2">
              <label htmlFor="override-reason">工程理由</label>
              <textarea id="override-reason" name="reason" required />
            </div>
            <div className="field span-2">
              <label htmlFor="override-evidence">依據／證據</label>
              <input id="override-evidence" name="evidence" required />
            </div>
          </div>
          <div className="button-row end" style={{ marginTop: 16 }}>
            <button
              className="button primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "正在核准…" : "核准並留下紀錄"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
