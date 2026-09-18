import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  exportReportDraft,
  previewReport,
} from "@/application/reports/report-service";
import { toProblem } from "@/application/problem";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";

interface Preview {
  version: number;
  reportNumber: string;
  snapshotHash: string;
  exported: boolean;
  legacyIssued: boolean;
  case: {
    caseNo: string;
    revisionNo: number;
    title: string;
    customer: string;
    location: string;
    mode: string;
    lifecycleStatus: string;
    calculationStatus: string;
  };
  assessments: Array<{ track: string; status: string }>;
  html: string;
  formalHtml: string;
}

type PdfKind = "DRAFT" | "FORMAL";

export function ReportPreview({ caseId }: { caseId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState<PdfKind | null>(null);
  const [lastPdfKind, setLastPdfKind] = useState<PdfKind>("DRAFT");
  const [pdfSavedPath, setPdfSavedPath] = useState<string | null>(null);
  const [pdfSavedKind, setPdfSavedKind] = useState<PdfKind | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<UiProblem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFrameReady(false);
    setPdfSavedPath(null);
    setProblem(null);
    try {
      setPreview(await previewReport(caseId));
    } catch (error) {
      setProblem(toProblem(error, "報告草稿預覽尚未完成，請重試。"));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  function handleFrameLoad() {
    setFrameReady(true);
  }

  async function generateReportPdf(kind: PdfKind) {
    if (!preview) return;
    setPdfGenerating(kind);
    setLastPdfKind(kind);
    setPdfSavedPath(null);
    setPdfSavedKind(null);
    setProblem(null);
    try {
      let source = preview;
      if (kind === "FORMAL" && !source.exported) {
        const exported = await exportReportDraft(caseId, source.version);
        source = {
          ...source,
          version: exported.caseVersion,
          reportNumber: exported.reportNumber,
          snapshotHash: exported.snapshotHash,
          exported: true,
          html: exported.html,
          formalHtml: exported.formalHtml,
        };
        setFrameReady(false);
        setPreview(source);
      }
      const revision = String(source.case.revisionNo).padStart(2, "0");
      const fileName =
        kind === "FORMAL"
          ? `${source.case.caseNo}-R${revision}.pdf`
          : `${source.case.caseNo}-DRAFT.pdf`;
      const response = await fetch("/api/report-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: kind === "FORMAL" ? source.formalHtml : source.html,
          fileName,
        }),
      });
      const result = (await response.json()) as { savedPath?: unknown };
      if (!response.ok || typeof result.savedPath !== "string") {
        throw new Error("REPORT_PDF_FAILED");
      }
      setPdfSavedPath(result.savedPath);
      setPdfSavedKind(kind);
    } catch {
      setProblem({
        code: "REPORT_PDF_FAILED",
        title: "PDF 產生失敗",
        userMessage: "PDF 未完成儲存，請再試一次。",
        retryable: true,
      });
    } finally {
      setPdfGenerating(null);
    }
  }

  async function exportDraft() {
    if (!preview) return;
    setSubmitting(true);
    setProblem(null);
    try {
      const exported = await exportReportDraft(caseId, preview.version);
      setFrameReady(false);
      setPdfSavedPath(null);
      setPreview((current) =>
        current
          ? {
              ...current,
              version: exported.caseVersion,
              reportNumber: exported.reportNumber,
              snapshotHash: exported.snapshotHash,
              exported: true,
              html: exported.html,
              formalHtml: exported.formalHtml,
            }
          : current,
      );
    } catch (error) {
      setProblem(toProblem(error, "報告草稿匯出未完成，請重新載入後再重試。"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="state-banner" aria-live="polite">
          建立預覽中…
        </div>
      </div>
    );
  }
  if (problem && !preview) {
    return (
      <div className="page">
        <RuntimeError problem={problem} onRetry={() => void load()} />
      </div>
    );
  }
  if (!preview) return null;

  return (
    <div className="page report-preview-page">
      <header className="page-header no-print">
        <div>
          <h1>報告草稿預覽</h1>
        </div>
        <div className="actions">
          <Link to={`/cases/${caseId}`}>返回案件</Link>
        </div>
      </header>

      {problem ? (
        <div className="no-print">
          <RuntimeError
            problem={problem}
            onRetry={
              problem.code === "REPORT_PDF_FAILED"
                ? () => void generateReportPdf(lastPdfKind)
                : () => void load()
            }
          />
        </div>
      ) : null}

      <section
        className="panel report-controls no-print"
        aria-label="報告操作"
      >
        <div className="button-row end">
          {!preview.legacyIssued ? (
            <button
              className="button secondary"
              type="button"
              disabled={submitting || Boolean(pdfGenerating)}
              onClick={() => void exportDraft()}
            >
              {submitting ? "正在準備草稿…" : "匯出報告草稿"}
            </button>
          ) : null}
          <button
            className="button secondary"
            type="button"
            disabled={submitting || Boolean(pdfGenerating) || !frameReady}
            onClick={() => void generateReportPdf("DRAFT")}
          >
            {pdfGenerating === "DRAFT" ? "正在產生草稿…" : "產生草稿 PDF"}
          </button>
          {!preview.legacyIssued ? (
            <button
              className="button primary"
              type="button"
              disabled={submitting || Boolean(pdfGenerating)}
              onClick={() => void generateReportPdf("FORMAL")}
            >
              {pdfGenerating === "FORMAL"
                ? "正在產生正式報告…"
                : "產生正式報告"}
            </button>
          ) : null}
        </div>
        {pdfSavedPath ? (
          <p className="report-pdf-status" role="status">
            {pdfSavedKind === "FORMAL" ? "正式報告 PDF" : "草稿 PDF"}
            {" 已儲存至："}
            {pdfSavedPath}
          </p>
        ) : null}
      </section>

      <section className="panel report-document-panel" aria-label="文件預覽">
        <iframe
          key={`${preview.version}-${preview.reportNumber}`}
          title="客戶設計計算報告草稿預覽"
          srcDoc={preview.html}
          sandbox="allow-modals allow-same-origin"
          onLoad={handleFrameLoad}
        />
      </section>
    </div>
  );
}
