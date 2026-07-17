import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  exportReportDraft,
  previewReport,
} from "@/application/reports/report-service";
import { toProblem } from "@/application/problem";
import { basisForTrack, modeDisplayFor } from "@/domain/rules/source-display";
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
}

const reportAssetTimeoutMs = 15_000;
const reportFontQuery = '400 12px "Jenfu Report Sans"';
const reportFontProbe = "鉦富機械油脂截留器報告草稿 0123456789";

async function waitForImage(image: HTMLImageElement): Promise<void> {
  if (!image.complete) {
    await new Promise<void>((resolve, reject) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener(
        "error",
        () => reject(new Error(`Report image failed to load: ${image.src}`)),
        { once: true },
      );
    });
  }
  if (image.naturalWidth === 0) {
    throw new Error(`Report image is unavailable: ${image.src}`);
  }
  if (typeof image.decode === "function") {
    await image.decode();
  }
}

async function waitForReportAssets(
  frame: HTMLIFrameElement | null,
): Promise<Window> {
  const printWindow = frame?.contentWindow;
  const document = frame?.contentDocument;
  if (!printWindow || !document || document.readyState !== "complete") {
    throw new Error("Report frame is not ready");
  }

  const ready = async () => {
    const loadedFonts = await document.fonts.load(
      reportFontQuery,
      reportFontProbe,
    );
    await document.fonts.ready;
    if (
      loadedFonts.length === 0 ||
      !document.fonts.check(reportFontQuery, reportFontProbe)
    ) {
      throw new Error("Bundled report font is unavailable");
    }
    await Promise.all(Array.from(document.images, waitForImage));
    await new Promise<void>((resolve) => {
      printWindow.requestAnimationFrame(() =>
        printWindow.requestAnimationFrame(() => resolve()),
      );
    });
  };

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      ready(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Report assets timed out")),
          reportAssetTimeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  return printWindow;
}

export function ReportPreview({ caseId }: { caseId: string }) {
  const reportFrame = useRef<HTMLIFrameElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [printRequested, setPrintRequested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<UiProblem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFrameReady(false);
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
    void load();
  }, [load]);

  const printReport = useCallback(async () => {
    setPrinting(true);
    setProblem(null);
    try {
      const printWindow = await waitForReportAssets(reportFrame.current);
      printWindow.focus();
      printWindow.print();
    } catch {
      setProblem({
        code: "PRINT_ASSETS_NOT_READY",
        title: "報告資產尚未準備完成",
        userMessage: "報告字型或圖片載入未完成，請重新載入報告後再試一次。",
        retryable: true,
      });
    } finally {
      setPrinting(false);
    }
  }, []);

  useEffect(() => {
    if (!printRequested || !frameReady) return;
    setPrintRequested(false);
    void printReport();
  }, [frameReady, printReport, printRequested]);

  async function exportDraft() {
    if (!preview) return;
    setSubmitting(true);
    setProblem(null);
    try {
      const exported = await exportReportDraft(caseId, preview.version);
      setFrameReady(false);
      setPrintRequested(true);
      setPreview((current) =>
        current
          ? {
              ...current,
              version: exported.caseVersion,
              reportNumber: exported.reportNumber,
              snapshotHash: exported.snapshotHash,
              exported: true,
              html: exported.html,
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
          正在建立報告草稿預覽，完成後可使用瀏覽器列印或另存 PDF。
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
          <p className="muted" style={{ marginBottom: 5 }}>
            {preview.case.caseNo}｜修訂 {preview.case.revisionNo}
          </p>
          <h1>報告草稿預覽</h1>
          <p className="lede">
            本頁產生可列印草稿，不代表公司身分驗證或公司簽核效力。
          </p>
        </div>
        <div className="actions">
          <Link to={`/cases/${caseId}`}>返回案件</Link>
        </div>
      </header>

      {problem ? (
        <div className="no-print">
          <RuntimeError problem={problem} onRetry={() => void load()} />
        </div>
      ) : null}

      {preview.legacyIssued ? (
        <div className="state-banner warning no-print" role="status">
          <strong>這是舊系統的歷史資料。</strong>
          <p>靜態版只提供唯讀預覽與列印，不會建立新的公司簽核紀錄。</p>
        </div>
      ) : preview.exported ? (
        <div className="state-banner no-print" role="status">
          <strong>報告草稿已保存於共享案件。</strong>
          <p>
            系統會等隨附字型與圖片完成載入後再列印；紙張、縮放與瀏覽器列印引擎仍可能造成細微差異。
          </p>
        </div>
      ) : (
        <div className="state-banner warning no-print" role="status">
          <strong>目前是尚未保存的預覽。</strong>
          <p>匯出時會保存案件內的草稿快照，並開啟瀏覽器列印視窗。</p>
        </div>
      )}

      <section className="panel no-print">
        <dl className="summary-grid">
          <div>
            <dt>案件／修訂</dt>
            <dd>
              {preview.case.caseNo} / {preview.case.revisionNo}
            </dd>
          </div>
          <div>
            <dt>客戶</dt>
            <dd>{preview.case.customer}</dd>
          </div>
          <div>
            <dt>設置地點</dt>
            <dd>{preview.case.location}</dd>
          </div>
          <div>
            <dt>計算依據</dt>
            <dd>{modeDisplayFor(preview.case.mode).label}</dd>
          </div>
          <div>
            <dt>完成依據</dt>
            <dd>
              {preview.assessments
                .filter((item) => item.status === "CALCULATED")
                .map((item) => basisForTrack(item.track).shortLabel)
                .join("、")}
            </dd>
          </div>
          <div>
            <dt>草稿編號</dt>
            <dd>{preview.reportNumber}</dd>
          </div>
        </dl>
        <div className="button-row end" style={{ marginTop: 18 }}>
          {!preview.legacyIssued ? (
            <button
              className="button primary"
              type="button"
              disabled={submitting || printing}
              onClick={() => void exportDraft()}
            >
              {submitting ? "正在準備草稿…" : "匯出報告草稿"}
            </button>
          ) : null}
          <button
            className="button secondary"
            type="button"
            disabled={submitting || printing || !frameReady}
            onClick={() => void printReport()}
          >
            {printing ? "正在準備列印…" : "列印／另存 PDF"}
          </button>
        </div>
      </section>

      <section className="panel report-document-panel">
        <h2 className="no-print">文件預覽</h2>
        <iframe
          ref={reportFrame}
          title="客戶設計計算報告草稿預覽"
          srcDoc={preview.html}
          sandbox="allow-modals allow-same-origin"
          onLoad={() => setFrameReady(true)}
        />
      </section>
    </div>
  );
}
