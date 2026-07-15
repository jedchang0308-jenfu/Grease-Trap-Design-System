"use client";

import { useCallback, useEffect, useState } from "react";
import { basisForTrack } from "@/domain/rules/source-display";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";
import { StatusBadge } from "@/ui/components/status-badge";
import { fetchJson, UiRequestError } from "@/ui/lib/fetch-json";

interface RuleSet {
  id: string;
  code: string;
  version: string;
  methodFamily: string;
  status: string;
  checksum: string;
  activatedAt: string;
  source: string;
  sourceHash: string;
}

export function RulesList() {
  const [items, setItems] = useState<RuleSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<UiProblem | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      setItems((await fetchJson<{ items: RuleSet[] }>("/api/rule-sets")).items);
    } catch (error) {
      setProblem(
        error instanceof UiRequestError
          ? error.problem
          : { userMessage: "規則版本載入未完成，請重試。" },
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>規則版本與來源</h1>
          <p className="lede">
            查閱目前使用中的計算依據與來源文件；ACTIVE 版本不可直接修改。
          </p>
        </div>
        <div className="actions">
          <button
            className="button primary"
            disabled
            title="第一階段僅提供版本查閱與 seed 驗證"
          >
            建立規則版本
          </button>
        </div>
      </header>
      {problem ? (
        <RuntimeError problem={problem} onRetry={() => void load()} />
      ) : null}
      {loading ? (
        <div className="state-banner" aria-live="polite">
          正在載入規則與來源。
        </div>
      ) : null}
      {!loading && !problem ? (
        <section className="panel">
          <table className="case-table">
            <thead>
              <tr>
                <th>方法</th>
                <th>版本</th>
                <th>來源</th>
                <th>狀態</th>
                <th>Checksum</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td data-label="方法">
                    <span className="case-title">
                      {item.methodFamily === "CURRENT_QG"
                        ? basisForTrack("CURRENT_QG").shortLabel
                        : basisForTrack("LEGACY_QV").shortLabel}
                    </span>
                    <span className="case-meta">{item.code}</span>
                  </td>
                  <td data-label="版本">{item.version}</td>
                  <td data-label="來源">
                    {basisForTrack(item.methodFamily).fullLabel}
                    <span className="case-meta">來源文件：{item.source}</span>
                    <details>
                      <summary>來源雜湊</summary>
                      <code>{item.sourceHash}</code>
                    </details>
                  </td>
                  <td data-label="狀態">
                    <StatusBadge status={item.status} />
                  </td>
                  <td data-label="Checksum">
                    <code>{item.checksum.slice(0, 12)}…</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
