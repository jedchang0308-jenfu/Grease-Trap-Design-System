import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  exportReportDraft,
  previewReport,
} from "@/application/reports/report-service";
import {
  historicalReportFileName,
  previewHistoricalReport,
} from "@/application/reports/historical-report-service";
import { toProblem } from "@/application/problem";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";

export interface Preview {
  version: number;
  reportNumber: string;
  snapshotHash: string;
  exported: boolean;
  legacyIssued: boolean;
  historical?: boolean;
  sourceRevisionNo?: number;
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
  htmlWithReferenceCalculations: string;
  formalHtmlWithReferenceCalculations: string;
}

type PdfKind = "DRAFT" | "FORMAL";
type ReportCalculationMode = "PURPOSE_ONLY" | "FULL";
const useLocalPdfRenderer = import.meta.env.VITE_REPORT_PDF_LOCAL === "true";

function selectedReportHtml(
  preview: Preview,
  kind: PdfKind,
  includeReferenceCalculations: boolean,
) {
  if (kind === "FORMAL")
    return includeReferenceCalculations
      ? preview.formalHtmlWithReferenceCalculations
      : preview.formalHtml;
  return includeReferenceCalculations
    ? preview.htmlWithReferenceCalculations
    : preview.html;
}

function printReportHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.left = "-10000px";
    frame.style.top = "0";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.border = "0";

    const cleanup = () => {
      window.setTimeout(() => frame.remove(), 1_000);
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("REPORT_PRINT_TIMEOUT"));
    }, 15_000);

    frame.addEventListener(
      "load",
      () => {
        void (async () => {
          try {
            const printWindow = frame.contentWindow;
            if (!printWindow) throw new Error("REPORT_PRINT_UNAVAILABLE");
            await printWindow.document.fonts.ready;
            await Promise.all(
              Array.from(printWindow.document.images, async (image) => {
                if (!image.complete) {
                  await new Promise<void>((resolveImage, rejectImage) => {
                    image.addEventListener("load", () => resolveImage(), {
                      once: true,
                    });
                    image.addEventListener("error", () => rejectImage(), {
                      once: true,
                    });
                  });
                }
                if (image.naturalWidth === 0) {
                  throw new Error("REPORT_PRINT_IMAGE_UNAVAILABLE");
                }
              }),
            );
            window.clearTimeout(timeout);
            printWindow.addEventListener("afterprint", cleanup, {
              once: true,
            });
            printWindow.focus();
            printWindow.print();
            cleanup();
            resolve();
          } catch (error) {
            window.clearTimeout(timeout);
            cleanup();
            reject(error);
          }
        })();
      },
      { once: true },
    );
    frame.srcdoc = html;
    document.body.append(frame);
  });
}

export function ReportPreview({
  caseId,
  revisionNo,
}: {
  caseId: string;
  revisionNo?: number;
}) {
  const historical = revisionNo !== undefined;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState<PdfKind | null>(null);
  const [lastPdfKind, setLastPdfKind] = useState<PdfKind>("DRAFT");
  const [pdfSavedPath, setPdfSavedPath] = useState<string | null>(null);
  const [pdfSavedKind, setPdfSavedKind] = useState<PdfKind | null>(null);
  const [pdfPrintKind, setPdfPrintKind] = useState<PdfKind | null>(null);
  const [reportCalculationMode, setReportCalculationMode] =
    useState<ReportCalculationMode>("PURPOSE_ONLY");
  const includeReferenceCalculations = reportCalculationMode === "FULL";
  const [frameReady, setFrameReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<UiProblem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFrameReady(false);
    setPdfSavedPath(null);
    setPdfPrintKind(null);
    setProblem(null);
    try {
      setPreview(
        historical
          ? await previewHistoricalReport(caseId, revisionNo)
          : await previewReport(caseId),
      );
    } catch (error) {
      setProblem(toProblem(error, "報告草稿預覽尚未完成，請重試。"));
    } finally {
      setLoading(false);
    }
  }, [caseId, historical, revisionNo]);

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
    setPdfPrintKind(null);
    setProblem(null);
    try {
      let source = preview;
      if (!historical && kind === "FORMAL" && !source.exported) {
        const exported = await exportReportDraft(caseId, source.version);
        source = {
          ...source,
          version: exported.caseVersion,
          reportNumber: exported.reportNumber,
          snapshotHash: exported.snapshotHash,
          exported: true,
          html: exported.html,
          formalHtml: exported.formalHtml,
          htmlWithReferenceCalculations: exported.htmlWithReferenceCalculations,
          formalHtmlWithReferenceCalculations:
            exported.formalHtmlWithReferenceCalculations,
        };
        setFrameReady(false);
        setPreview(source);
      }
      const fileName = historical
        ? historicalReportFileName(source.case.caseNo, source.case.revisionNo)
        : kind === "FORMAL"
          ? `${source.case.caseNo}-R${String(source.case.revisionNo).padStart(2, "0")}.pdf`
          : `${source.case.caseNo}-DRAFT.pdf`;
      const selectedHtml = selectedReportHtml(
        source,
        kind,
        includeReferenceCalculations,
      );
      if (!useLocalPdfRenderer) {
        await printReportHtml(selectedHtml);
        setPdfPrintKind(kind);
        return;
      }
      const response = await fetch("/api/report-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: selectedHtml,
          fileName,
        }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        await printReportHtml(selectedHtml);
        setPdfPrintKind(kind);
        return;
      }
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
      if (historical) return;
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
              htmlWithReferenceCalculations:
                exported.htmlWithReferenceCalculations,
              formalHtmlWithReferenceCalculations:
                exported.formalHtmlWithReferenceCalculations,
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
          <h1>{historical ? "歷史報告重新產生預覽" : "報告草稿預覽"}</h1>
        </div>
        <div className="actions">
          <Link
            to={historical ? `/cases/${caseId}/history` : `/cases/${caseId}`}
          >
            {historical ? "返回版本清單" : "返回案件"}
          </Link>
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

      {historical ? (
        <div className="state-banner warning no-print" role="status">
          <strong>歷史版本重新產生</strong>
          <p>
            本預覽使用保存的歷史資料套用目前版型，不是當時的原始
            PDF；不會回寫目前案件。
          </p>
        </div>
      ) : null}

      <section className="panel report-controls no-print" aria-label="報告操作">
        <fieldset className="report-settings-row">
          <legend>報告設定</legend>
          <div className="report-settings-options" role="radiogroup">
            {(
              [
                ["PURPOSE_ONLY", "精簡計算-只計算此次目的"],
                ["FULL", "完整計算-連同參考資訊一同完整計算"],
              ] as const
            ).map(([value, label]) => (
              <label className="report-setting-option" key={value}>
                <input
                  type="radio"
                  name="report-calculation-mode"
                  value={value}
                  checked={reportCalculationMode === value}
                  disabled={submitting || Boolean(pdfGenerating)}
                  onChange={() => {
                    setFrameReady(false);
                    setPdfSavedPath(null);
                    setPdfSavedKind(null);
                    setPdfPrintKind(null);
                    setReportCalculationMode(value);
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="report-action-groups">
          {!preview.legacyIssued && !historical ? (
            <div className="report-save-action">
              <button
                className="button secondary"
                type="button"
                disabled={submitting || Boolean(pdfGenerating)}
                onClick={() => void exportDraft()}
              >
                {submitting ? "正在儲存草稿…" : "儲存草稿版本"}
              </button>
            </div>
          ) : null}
          <div className="button-row end report-output-actions">
            <button
              className="button secondary"
              type="button"
              disabled={submitting || Boolean(pdfGenerating) || !frameReady}
              onClick={() => void generateReportPdf("DRAFT")}
            >
              {pdfGenerating === "DRAFT" ? "正在輸出草稿 PDF…" : "輸出草稿 PDF"}
            </button>
            {!preview.legacyIssued || historical ? (
              <button
                className="button primary"
                type="button"
                disabled={submitting || Boolean(pdfGenerating)}
                onClick={() => void generateReportPdf("FORMAL")}
              >
                {pdfGenerating === "FORMAL"
                  ? "正在輸出正式 PDF…"
                  : "輸出正式 PDF"}
              </button>
            ) : null}
          </div>
        </div>
        {pdfPrintKind ? (
          <p className="report-pdf-status" role="status">
            {pdfPrintKind === "FORMAL" ? "正式報告 PDF" : "草稿 PDF"}
            {" 已開啟瀏覽器列印視窗，請選擇「另存為 PDF」。"}
          </p>
        ) : pdfSavedPath ? (
          <p className="report-pdf-status" role="status">
            {pdfSavedKind === "FORMAL" ? "正式報告 PDF" : "草稿 PDF"}
            {" 已儲存至："}
            {pdfSavedPath}
          </p>
        ) : null}
      </section>

      <section className="panel report-document-panel" aria-label="文件預覽">
        <iframe
          key={`${preview.version}-${preview.reportNumber}-${includeReferenceCalculations ? "with-reference" : "purpose-only"}`}
          title={historical ? "歷史版本報告預覽" : "客戶設計計算報告草稿預覽"}
          srcDoc={selectedReportHtml(
            preview,
            "DRAFT",
            includeReferenceCalculations,
          )}
          sandbox="allow-modals allow-same-origin"
          onLoad={handleFrameLoad}
        />
      </section>
    </div>
  );
}
