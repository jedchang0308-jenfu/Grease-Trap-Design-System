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
};

const modeLabels: Record<string, string> = {
  CURRENT_QG: calculationModeDisplay.CURRENT_QG.label,
  LEGACY_QV: calculationModeDisplay.LEGACY_QV.label,
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
    void load();
  }, [load]);

  async function deleteCase(item: CaseSummary) {
    const displayTitle = item.title.trim() || item.caseNo;
    if (
      !window.confirm(
        `確定刪除案件「${displayTitle}」（${item.caseNo}）？\n\n這會刪除案件的全部修訂、計算結果與報告紀錄，且無法復原。`,
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
          <p className="lede">找到目前案件、確認狀態，直接前往下一步。</p>
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
            <label htmlFor="mode-filter">模式</label>
            <select
              id="mode-filter"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              <option value="">全部模式</option>
              <option value="CURRENT_QG">
                {calculationModeDisplay.CURRENT_QG.label}
              </option>
              <option value="LEGACY_QV">
                {calculationModeDisplay.LEGACY_QV.label}
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
          <button
            className="button secondary"
            type="button"
            onClick={() => void load()}
          >
            套用篩選
          </button>
        </div>

        {problem ? (
          <RuntimeError problem={problem} onRetry={() => void load()} />
        ) : null}
        {loading ? (
          <div className="state-banner" aria-live="polite">
            正在載入案件，完成後會顯示可執行的下一步。
          </div>
        ) : null}
        {!loading && !problem && items.length === 0 ? (
          <div className="empty-state">
            <h2>目前還沒有案件</h2>
            <p className="muted">
              建立第一筆案件後，即可依人數、面積或設備能力開始計算。
            </p>
            <Link className="button primary" to="/cases/new">
              建立案件
            </Link>
          </div>
        ) : null}
        {!loading && !problem && items.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table className="case-table">
              <thead>
                <tr>
                  <th>案件</th>
                  <th>客戶／地點</th>
                  <th>任務／模式</th>
                  <th>狀態</th>
                  <th>最後更新</th>
                  <th>下一步</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.caseId}-${item.revisionNo}`}>
                    <td data-label="案件">
                      <span className="case-title">
                        {item.title.trim() || item.caseNo}
                      </span>
                      <span className="case-meta">
                        {item.caseNo}｜修訂 {item.revisionNo}
                      </span>
                    </td>
                    <td data-label="客戶／地點">
                      {item.customer.trim() || "未填客戶"}
                      <span className="case-meta" style={{ display: "block" }}>
                        {item.location.trim() || "未填地點"}
                      </span>
                    </td>
                    <td data-label="任務／模式">
                      {taskLabels[item.taskCode] ?? item.taskCode}
                      <span className="case-meta" style={{ display: "block" }}>
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
                    <td data-label="下一步">
                      <Link to={`/cases/${item.caseId}`}>開啟案件</Link>
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
                          className="button danger"
                          type="button"
                          disabled={deletingCaseId === item.caseId}
                          onClick={() => void deleteCase(item)}
                        >
                          {deletingCaseId === item.caseId
                            ? "正在刪除…"
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
