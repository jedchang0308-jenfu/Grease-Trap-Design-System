"use client";

import { useState, type FormEvent } from "react";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";
import { fetchJson, UiRequestError } from "@/ui/lib/fetch-json";

export interface EngineeringOverride {
  id?: string;
  resultPath: string;
  beforeValue: unknown;
  afterValue: unknown;
  reason: string;
  evidence: string;
  status?: string;
}

export function EngineeringOverridePanel({
  caseId,
  existing,
  editable,
  onCreated,
}: {
  caseId: string;
  existing: EngineeringOverride[];
  editable: boolean;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<UiProblem | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
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
      onCreated?.();
    } catch (error) {
      setProblem(
        error instanceof UiRequestError
          ? error.problem
          : { userMessage: "人工採用紀錄未建立，請重試。" },
      );
    } finally {
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
            {editable
              ? "核發前可保存人工採用紀錄；系統會保留前後值、理由與依據。"
              : "這些人工採用已納入目前報告；若內容需變更，請在核發前回到案件調整。"}
          </p>
        </div>
        {editable ? (
          <div className="actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "取消" : "建立人工採用"}
            </button>
          </div>
        ) : null}
      </div>
      {problem ? <RuntimeError problem={problem} /> : null}
      {existing.length ? (
        existing.map((item) => (
          <div
            className="state-banner warning"
            key={item.id ?? `${item.resultPath}-${String(item.afterValue)}`}
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
        ))
      ) : (
        <p className="muted">本報告沒有人工採用紀錄。</p>
      )}
      {editable && open ? (
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
              {submitting ? "正在保存…" : "保存並納入草稿"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
