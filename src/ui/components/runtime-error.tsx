import { Link } from "react-router-dom";

export interface UiProblem {
  code?: string;
  title?: string;
  userMessage?: string;
  correlationId?: string;
  retryable?: boolean;
  fieldErrors?: Record<string, string[]>;
}

export function RuntimeError({
  problem,
  onRetry,
}: {
  problem: UiProblem;
  onRetry?: () => void;
}) {
  return (
    <div className="runtime-error" role="alert">
      <strong>
        {problem.userMessage ?? "目前未完成這次操作，請重試或返回安全頁面。"}
      </strong>
      <div className="button-row" style={{ marginTop: 12 }}>
        {onRetry ? (
          <button className="button secondary" type="button" onClick={onRetry}>
            重試
          </button>
        ) : null}
        <Link className="button secondary" to="/cases">
          返回案件清單
        </Link>
      </div>
      {(problem.code || problem.correlationId) && (
        <details style={{ marginTop: 12 }}>
          <summary>技術資訊</summary>
          <p className="muted">
            事件：{problem.code ?? "UNKNOWN"}
            {problem.correlationId ? `｜${problem.correlationId}` : ""}
          </p>
        </details>
      )}
    </div>
  );
}
