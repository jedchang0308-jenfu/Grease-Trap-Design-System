import { useCallback, useEffect, useState } from "react";
import { toProblem } from "@/application/problem";
import { presentRuleSets } from "@/domain/rules/catalog";
import { basisForTrack } from "@/domain/rules/source-display";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";
import { StatusBadge } from "@/ui/components/status-badge";

interface RuleSet {
  id: string;
  version: string;
  versionLabel: string;
  publicationDate: string;
  methodFamily: string;
  status: string;
}

export function RulesList() {
  const [items, setItems] = useState<RuleSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<UiProblem | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      setItems(presentRuleSets());
    } catch (error) {
      setProblem(toProblem(error, "規則版本載入未完成，請重試。"));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  return (
    <div className="page">
      {problem ? (
        <RuntimeError problem={problem} onRetry={() => void load()} />
      ) : null}
      {loading ? (
        <div className="state-banner" aria-live="polite">
          載入規則中…
        </div>
      ) : null}
      {!loading && !problem ? (
        <section className="panel">
          <table className="case-table">
            <thead>
              <tr>
                <th>方法</th>
                <th>版本</th>
                <th>發布日期</th>
                <th>來源</th>
                <th>文件</th>
                <th>狀態</th>
                <th>備註</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const basis = basisForTrack(item.methodFamily);
                return (
                  <tr key={item.id}>
                    <td data-label="方法">
                      <span className="case-title">{basis.documentName}</span>
                    </td>
                    <td data-label="版本">{item.versionLabel}</td>
                    <td data-label="發布日期">{item.publicationDate}</td>
                    <td data-label="來源">{basis.fullLabel}</td>
                    <td data-label="文件">
                      {basis.pdfHref ? (
                        <div className="source-document-actions">
                          <a
                            className="source-pdf-link"
                            href={basis.pdfHref}
                            target="_blank"
                            rel="noreferrer"
                          >
                            開啟完整 PDF
                          </a>
                        </div>
                      ) : null}
                    </td>
                    <td data-label="狀態">
                      <StatusBadge status={item.status} />
                    </td>
                    <td data-label="備註">{basis.systemNote}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
