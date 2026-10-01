import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteCaseGroup, listCases } from "@/application/cases/repository";
import { toProblem } from "@/application/problem";
import { calculationModeDisplay } from "@/domain/rules/source-display";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";
import { StatusBadge } from "@/ui/components/status-badge";

interface CaseSummary {
  caseId: string;
  caseNo: string;
  revisionNo: number;
  customer: string;
  location: string;
  title: string;
  taskCode: string;
  mode: string;
  lifecycleStatus: string;
  calculationStatus: string | null;
  updatedAt: string;
}

const taskLabels: Record<string, string> = {
  T01_DINERS_TO_FLOW: "人數換算流量",
  T02_DINERS_TO_DESIGN: "人數規劃設計需求",
  T03_AREA_TO_FLOW: "面積換算流量",
  T04_AREA_TO_DESIGN: "面積規劃設計需求",
  T05_DESIGN_TO_DINERS_AND_AREA: "能力反推人數及面積",
  T06_EFFECTIVE_VOLUME_TO_FLOW: "有效容積換算設計處理水量",
};

const modeLabels: Record<string, string> = {
  LEGACY_QV: calculationModeDisplay.LEGACY_QV.label,
  CURRENT_QG: calculationModeDisplay.CURRENT_QG.label,
  DUAL_COMPARISON: calculationModeDisplay.DUAL_COMPARISON.label,
};

export function CasesList() {
  const [items, setItems] = useState<CaseSummary[]>([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);
  const [problem, setProblem] = useState<UiProblem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      const records = await listCases({ search, mode, status });
      setItems(
        records.map((record) => ({
          caseId: record.case_group_id,
          caseNo: record.case_no,
          revisionNo: record.revision_no,
          customer: record.customer,
          location: record.location,
          title: record.title,
          taskCode: record.task_code,
          mode: record.mode,
          lifecycleStatus: record.lifecycle_status,
          calculationStatus: record.calculation_status,
          updatedAt: record.updated_at,
        })),
      );
    } catch (error) {
      setProblem(toProblem(error, "案件載入未完成，請重試。"));
    } finally {
      setLoading(false);
    }
  }, [mode, search, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function deleteCase(item: CaseSummary) {
    const displayTitle = item.title.trim() || item.caseNo;
    if (
      item.lifecycleStatus !== "DELETING" &&
      !window.confirm(
        `確定刪除案件「${displayTitle}」（${item.caseNo}）？\n\n這會刪除案件的全部版本、計算結果與報告紀錄，且無法復原。`,
      )
    ) {
      return;
    }

    setDeletingCaseId(item.caseId);
    setProblem(null);
    try {
      await deleteCaseGroup(item.caseId);
      await load();
    } catch (error) {
      setProblem(toProblem(error, "案件刪除未完成，請重試。"));
    } finally {
      setDeletingCaseId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>案件清單</h1>
        </div>
        <div className="actions">
          <Link className="button primary" to="/cases/new">
            建立案件
          </Link>
        </div>
      </header>

      <section className="panel" aria-label="案件篩選與結果">
        <div className="toolbar">
          <div className="field">
            <label htmlFor="case-search">搜尋案件</label>
            <input
              id="case-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="案件編號、客戶或名稱"
            />
          </div>
          <div className="field">
            <label htmlFor="mode-filter">計算方法</label>
            <select
              id="mode-filter"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              <option value="">所有</option>
              <option value="LEGACY_QV">
                {calculationModeDisplay.LEGACY_QV.label}
              </option>
              <option value="CURRENT_QG">
                {calculationModeDisplay.CURRENT_QG.label}
              </option>
              <option value="DUAL_COMPARISON">
                {calculationModeDisplay.DUAL_COMPARISON.label}
              </option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="status-filter">狀態</label>
            <select
              id="status-filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">全部狀態</option>
              <option value="DRAFT">草稿</option>
              <option value="CALCULATED">已計算</option>
              <option value="REPORT_DRAFT">報告草稿</option>
              <option value="ISSUED">舊系統歷史</option>
              <option value="BLOCKED">待補資料</option>
            </select>
          </div>
        </div>

        {problem ? (
          <RuntimeError problem={problem} onRetry={() => void load()} />
        ) : null}
        {loading ? (
          <div className="state-banner" aria-live="polite">
            載入案件中…
          </div>
        ) : null}
        {!loading && !problem && items.length === 0 ? (
          <div className="empty-state">
            <p>目前還沒有案件。</p>
          </div>
        ) : null}
        {!loading && !problem && items.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table className="case-table">
              <thead>
                <tr>
                  <th>案件</th>
                  <th>客戶／地點</th>
                  <th>計算任務／模式</th>
                  <th>狀態</th>
                  <th>最後更新</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.caseId}-${item.revisionNo}`}>
                    <td data-label="案件">
                      <Link className="case-title" to={`/cases/${item.caseId}`}>
                        {item.title.trim() || item.caseNo}
                      </Link>
                      <span className="case-meta">
                        {item.caseNo}｜版本 {item.revisionNo}
                      </span>
                      <Link
                        className="case-meta"
                        to={`/cases/${item.caseId}/history`}
                      >
                        查看歷史版本
                      </Link>
                    </td>
                    <td data-label="客戶／地點">
                      {item.customer.trim() || "未填客戶"}
                      <span className="case-meta">
                        {item.location.trim() || "未填地點"}
                      </span>
                    </td>
                    <td data-label="計算任務／模式">
                      {taskLabels[item.taskCode] ?? item.taskCode}
                      <span className="case-meta">
                        {modeLabels[item.mode] ?? item.mode}
                      </span>
                    </td>
                    <td data-label="狀態">
                      <StatusBadge
                        status={item.calculationStatus ?? item.lifecycleStatus}
                      />
                    </td>
                    <td data-label="最後更新">
                      {new Date(item.updatedAt).toLocaleString("zh-TW", {
                        timeZone: "Asia/Taipei",
                      })}
                    </td>
                    <td data-label="操作">
                      {[
                        "ISSUED",
                        "SUPERSEDED",
                        "IN_REVIEW",
                        "REVIEWED",
                      ].includes(item.lifecycleStatus) ? (
                        <span className="muted">歷史資料唯讀</span>
                      ) : (
                        <button
                          className="button danger compact"
                          type="button"
                          disabled={deletingCaseId === item.caseId}
                          onClick={() => void deleteCase(item)}
                        >
                          {deletingCaseId === item.caseId
                            ? "正在刪除…"
                            : item.lifecycleStatus === "DELETING"
                              ? "繼續刪除"
                              : "刪除案件"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
