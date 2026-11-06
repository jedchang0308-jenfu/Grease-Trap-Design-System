import { useCallback, useEffect, useState } from "react";
import { toProblem } from "@/application/problem";
import { presentRuleSets } from "@/domain/rules/catalog";
import { basisForTrack } from "@/domain/rules/source-display";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";

interface ReferenceDocument {
  id: string;
  documentName: string;
  versionLabel: string;
  publicationDate: string;
  source: string;
  documentHref: string;
  linkLabel?: string;
  systemNote: string;
}

const additionalReferences: ReferenceDocument[] = [
  {
    id: "CNS-14431-Q3001",
    documentName: "油脂截留器性能試驗法",
    versionLabel: "CNS 14431（Q3001）",
    publicationDate: "2000/05/11",
    source: "經濟部標準檢驗局",
    documentHref: "https://www.cnsonline.com.tw/",
    linkLabel: "查詢／購買標準",
    systemNote:
      "性能試驗方法；非算法 B 計算規範。全文依 CNS 標準系統授權取得。",
  },
  {
    id: "RDR-26110201",
    documentName: "油脂截留設施臺灣法規體系與市場實務分析報告",
    versionLabel: "V1",
    publicationDate: "2026/11/02",
    source: "鉦富機械有限公司",
    documentHref:
      "/rule-sources/RDR-26110201_油脂截留設施-法規體系與市場實務分析報告_V1.pdf",
    systemNote: "內有算法 A 及算法 B 的說明",
  },
];

export function RulesList() {
  const [items, setItems] = useState<ReferenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<UiProblem | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      setItems([
        ...presentRuleSets().map((item) => {
          const basis = basisForTrack(item.methodFamily);
          return {
            id: item.id,
            documentName: basis.documentName,
            versionLabel: item.versionLabel,
            publicationDate: item.publicationDate,
            source: basis.fullLabel,
            documentHref: basis.pdfHref,
            systemNote: basis.systemNote,
          };
        }),
        ...additionalReferences,
      ]);
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
          <table className="case-table rules-table">
            <thead>
              <tr>
                <th>文件名稱</th>
                <th>版本</th>
                <th>發布日期</th>
                <th>來源</th>
                <th>文件</th>
                <th>備註</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td data-label="文件名稱">
                    <span className="case-title">{item.documentName}</span>
                  </td>
                  <td data-label="版本">{item.versionLabel}</td>
                  <td data-label="發布日期">{item.publicationDate}</td>
                  <td data-label="來源">{item.source}</td>
                  <td data-label="文件">
                    {item.documentHref ? (
                      <div className="source-document-actions">
                        <a
                          className="source-document-link"
                          href={item.documentHref}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.linkLabel ?? "開啟完整 PDF"}
                        </a>
                      </div>
                    ) : null}
                  </td>
                  <td data-label="備註">{item.systemNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
