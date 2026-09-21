import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getHistoricalCase } from "@/application/cases/history-service";
import { toProblem, type ProblemDetails } from "@/application/problem";
import { RuntimeError } from "@/ui/components/runtime-error";
import { StatusBadge } from "@/ui/components/status-badge";
import type { CaseRecord } from "@/infrastructure/data/case-store";

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <details className="history-data-block">
      <summary>{label}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

function HistoricalSummary({ record }: { record: CaseRecord }) {
  return (
    <dl className="history-summary-grid">
      <div>
        <dt>案件</dt>
        <dd>
          {record.case_no}｜版本 {record.revision_no}
        </dd>
      </div>
      <div>
        <dt>最後更新</dt>
        <dd>{formatDate(record.updated_at)}</dd>
      </div>
      <div>
        <dt>客戶／地點</dt>
        <dd>
          {record.customer || "未填客戶"}｜{record.location || "未填地點"}
        </dd>
      </div>
      <div>
        <dt>狀態</dt>
        <dd>
          <StatusBadge
            status={record.calculation_status ?? record.lifecycle_status}
          />
        </dd>
      </div>
    </dl>
  );
}

export function CaseHistoryDetail({
  caseId,
  revisionNo,
}: {
  caseId: string;
  revisionNo: number;
}) {
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<ProblemDetails | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      const result = await getHistoricalCase(caseId, revisionNo);
      setRecord(result.revision);
    } catch (error) {
      setProblem(toProblem(error, "歷史版本載入未完成，請重試。"));
    } finally {
      setLoading(false);
    }
  }, [caseId, revisionNo]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  if (loading)
    return (
      <div className="page">
        <div className="state-banner">載入唯讀版本中…</div>
      </div>
    );
  if (problem)
    return (
      <div className="page">
        <RuntimeError problem={problem} onRetry={() => void load()} />
      </div>
    );
  if (!record) return null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted">唯讀歷史資料</p>
          <h1>{record.title.trim() || record.case_no}</h1>
        </div>
        <div className="actions button-row">
          <Link to={`/cases/${caseId}/history`}>返回版本清單</Link>
          <Link to={`/cases/${caseId}`}>返回目前案件</Link>
        </div>
      </header>
      <section className="panel history-detail-panel" aria-label="歷史版本摘要">
        <div className="state-banner warning">
          <strong>歷史版本｜唯讀</strong>
          <p>
            以下內容為保存當下的案件與計算資料，不會使用目前版本補值或重新計算。
          </p>
        </div>
        <HistoricalSummary record={record} />
        <div className="button-row history-detail-actions">
          {record.report_draft?.snapshot ? (
            <Link
              className="button primary"
              to={`/cases/${caseId}/history/${revisionNo}/report`}
            >
              重新產生歷史報告
            </Link>
          ) : (
            <span className="muted">
              此版本沒有保存的報告快照，無法重新產生報告。
            </span>
          )}
        </div>
        <div className="history-data-grid">
          <JsonBlock label="案件輸入" value={record.input_payload} />
          <JsonBlock label="計算結果" value={record.calculations} />
          <JsonBlock
            label="評估與覆寫紀錄"
            value={{
              assessments: record.assessments,
              overrides: record.overrides,
            }}
          />
          {record.report_draft?.snapshot ? (
            <JsonBlock
              label="報告快照摘要"
              value={record.report_draft.snapshot}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
