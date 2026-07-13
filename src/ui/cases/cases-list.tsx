"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";
import { StatusBadge } from "@/ui/components/status-badge";
import { fetchJson, UiRequestError } from "@/ui/lib/fetch-json";

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
  CURRENT_QG: "現行 Q/G",
  LEGACY_QV: "舊版 Q/V",
  DUAL_COMPARISON: "新舊雙軌",
};

export function CasesList() {
  const [items, setItems] = useState<CaseSummary[]>([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<UiProblem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    const params = new URLSearchParams({ search, mode, status });
    try {
      const response = await fetchJson<{ items: CaseSummary[] }>(
        `/api/cases?${params}`,
      );
      setItems(response.items);
    } catch (error) {
      setProblem(
        error instanceof UiRequestError
          ? error.problem
          : { userMessage: "案件載入未完成，請重試。" },
      );
    } finally {
      setLoading(false);
    }
  }, [mode, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>案件清單</h1>
          <p className="lede">找到目前案件、確認狀態，直接前往下一步。</p>
        </div>
        <div className="actions">
          <Link className="button primary" href="/cases/new">
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
              <option value="CURRENT_QG">現行 Q/G</option>
              <option value="LEGACY_QV">舊版 Q/V</option>
              <option value="DUAL_COMPARISON">新舊雙軌</option>
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
              <option value="IN_REVIEW">覆核中</option>
              <option value="REVIEWED">已覆核</option>
              <option value="ISSUED">已核發</option>
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
            <Link className="button primary" href="/cases/new">
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
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.caseId}-${item.revisionNo}`}>
                    <td data-label="案件">
                      <span className="case-title">{item.title}</span>
                      <span className="case-meta">
                        {item.caseNo}｜修訂 {item.revisionNo}
                      </span>
                    </td>
                    <td data-label="客戶／地點">
                      {item.customer}
                      <span className="case-meta" style={{ display: "block" }}>
                        {item.location}
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
                      <Link href={`/cases/${item.caseId}`}>開啟案件</Link>
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
