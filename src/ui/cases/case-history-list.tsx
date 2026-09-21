import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listCaseHistory,
  type CaseHistoryList,
} from "@/application/cases/history-service";
import { toProblem, type ProblemDetails } from "@/application/problem";
import { RuntimeError } from "@/ui/components/runtime-error";
import { StatusBadge } from "@/ui/components/status-badge";

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}

export function CaseHistoryList({ caseId }: { caseId: string }) {
  const [history, setHistory] = useState<CaseHistoryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<ProblemDetails | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      setHistory(await listCaseHistory(caseId));
    } catch (error) {
      setProblem(toProblem(error, "歷史版本載入未完成，請重試。"));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  if (loading) {
    return (
      <div className="page">
        <div className="state-banner">載入歷史版本中…</div>
      </div>
    );
  }
  if (problem) {
    return (
      <div className="page">
        <RuntimeError problem={problem} onRetry={() => void load()} />
      </div>
    );
  }
  if (!history) return null;

  const current = history.current;
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted">{current.case_no}</p>
          <h1>歷史版本</h1>
          <p className="lede">{current.title.trim() || current.case_no}</p>
        </div>
        <div className="actions button-row">
          <Link to={`/cases/${caseId}`}>返回目前案件</Link>
          <Link to="/cases">返回案件清單</Link>
        </div>
      </header>

      {history.deleting ? (
        <section className="state-banner warning" aria-live="polite">
          <strong>刪除未完成</strong>
          <p>案件清理中，歷史內容暫不顯示。請返回目前案件繼續刪除。</p>
          <Link className="button primary" to={`/cases/${caseId}`}>
            繼續刪除
          </Link>
        </section>
      ) : (
        <section className="panel history-panel" aria-label="案件版本列表">
          <div className="history-current-row">
            <div>
              <strong>目前版本 {current.revision_no}</strong>
              <span className="case-meta">
                最後更新：{formatDate(current.updated_at)}
              </span>
            </div>
            <div className="button-row">
              <StatusBadge
                status={current.calculation_status ?? current.lifecycle_status}
              />
              <Link
                className="button secondary compact"
                to={`/cases/${caseId}`}
              >
                開啟目前版本
              </Link>
            </div>
          </div>
          {history.revisions.length === 0 ? (
            <div className="empty-state">
              <p>尚無歷史版本。</p>
            </div>
          ) : (
            <div className="history-list">
              {history.revisions.map((revision) => (
                <article className="history-row" key={revision.id}>
                  <div>
                    <strong>歷史版本 {revision.revision_no}</strong>
                    <span className="case-meta">
                      保存內容最後更新：{formatDate(revision.updated_at)}
                    </span>
                  </div>
                  <div className="button-row">
                    <StatusBadge
                      status={
                        revision.calculation_status ?? revision.lifecycle_status
                      }
                    />
                    <Link
                      className="button secondary compact"
                      to={`/cases/${caseId}/history/${revision.revision_no}`}
                    >
                      查看唯讀版本
                    </Link>
                    {revision.report_draft?.snapshot ? (
                      <Link
                        className="button secondary compact"
                        to={`/cases/${caseId}/history/${revision.revision_no}/report`}
                      >
                        重新產生報告
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
          {history.missingRevisionNos.length > 0 ? (
            <div className="state-banner warning" role="status">
              早期版本未保留：版本 {history.missingRevisionNos.join("、")}{" "}
              不在可查詢的歷史資料中。
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
