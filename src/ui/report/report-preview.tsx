"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";
import { fetchJson, UiRequestError } from "@/ui/lib/fetch-json";
import { basisForTrack, modeDisplayFor } from "@/domain/rules/source-display";

interface Preview {
  reportNumber: string;
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

interface IssuedReport {
  id: string;
  reportNumber: string;
  status: string;
  issuedAt: string;
  downloadUrl: string;
}

export function ReportPreview({ caseId }: { caseId: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [issued, setIssued] = useState<IssuedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<UiProblem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      setPreview(
        await fetchJson<Preview>(`/api/cases/${caseId}/report-preview`),
      );
    } catch (error) {
      setProblem(
        error instanceof UiRequestError
          ? error.problem
          : { userMessage: "報告預覽尚未完成，請重試。" },
      );
    } finally {
      setLoading(false);
    }
  }, [caseId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function submitForReview() {
    setSubmitting(true);
    setProblem(null);
    try {
      await fetchJson(`/api/cases/${caseId}/submit-review`, { method: "POST" });
      router.push(`/cases/${caseId}/review`);
    } catch (error) {
      setProblem(
        error instanceof UiRequestError
          ? error.problem
          : { userMessage: "報告草稿尚未送出最終審核，請重試。" },
      );
      setSubmitting(false);
    }
  }

  async function issue() {
    setSubmitting(true);
    setProblem(null);
    try {
      const report = await fetchJson<IssuedReport>(
        `/api/cases/${caseId}/issue`,
        { method: "POST" },
      );
      setIssued(report);
      dialog.current?.close();
    } catch (error) {
      setProblem(
        error instanceof UiRequestError
          ? error.problem
          : { userMessage: "報告核發未完成；案件仍保留在已覆核狀態，請重試。" },
      );
      dialog.current?.close();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div className="page">
        <div className="state-banner" aria-live="polite">
          正在建立報告草稿，完成後會顯示計算依據與報告內容。
        </div>
      </div>
    );
  if (problem && !preview)
    return (
      <div className="page">
        <RuntimeError problem={problem} onRetry={() => void load()} />
      </div>
    );
  if (!preview) return null;
  const isIssued = issued || preview.case.lifecycleStatus === "ISSUED";
  const isDraft = preview.case.lifecycleStatus === "CALCULATED";
  const isInReview = preview.case.lifecycleStatus === "IN_REVIEW";
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted" style={{ marginBottom: 5 }}>
            {preview.case.caseNo}｜修訂 {preview.case.revisionNo}
          </p>
          <h1>報告預覽</h1>
          <p className="lede">只確認客戶需要的設計結果與完整計算過程。</p>
        </div>
        <div className="actions">
          <Link href={`/cases/${caseId}`}>返回案件</Link>
        </div>
      </header>
      {problem ? <RuntimeError problem={problem} /> : null}
      {issued ? (
        <div className="state-banner" style={{ marginBottom: 18 }}>
          <strong>報告已核發；如需變更內容，請建立新修訂版。</strong>
          <div className="button-row" style={{ marginTop: 12 }}>
            <a className="button primary" href={issued.downloadUrl}>
              下載已核發報告
            </a>
            <Link className="button secondary" href={`/cases/${caseId}`}>
              返回案件
            </Link>
          </div>
        </div>
      ) : null}
      <section className="panel">
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
            <dt>報告編號</dt>
            <dd>{issued?.reportNumber ?? preview.reportNumber}</dd>
          </div>
        </dl>
        <div className="button-row end" style={{ marginTop: 18 }}>
          {isIssued ? (
            issued ? (
              <a className="button primary" href={issued.downloadUrl}>
                下載已核發報告
              </a>
            ) : (
              <Link className="button primary" href={`/cases/${caseId}`}>
                查看已核發紀錄
              </Link>
            )
          ) : isDraft ? (
            <button
              className="button primary"
              type="button"
              disabled={submitting}
              onClick={() => void submitForReview()}
            >
              {submitting ? "正在送審…" : "送出最終審核"}
            </button>
          ) : isInReview ? (
            <Link className="button primary" href={`/cases/${caseId}/review`}>
              開始最終審核
            </Link>
          ) : (
            <button
              className="button primary"
              type="button"
              onClick={() => dialog.current?.showModal()}
            >
              核發此版本
            </button>
          )}
        </div>
      </section>
      <section className="panel">
        <h2>文件預覽</h2>
        <iframe
          title="客戶設計計算報告預覽"
          srcDoc={preview.html}
          style={{
            width: "100%",
            minHeight: 760,
            border: "1px solid var(--line)",
            background: "white",
          }}
          sandbox=""
        />
      </section>
      <dialog ref={dialog} onCancel={() => dialog.current?.close()}>
        <div className="dialog-body">
          <h2>確認核發此版本？</h2>
          <p>核發後此版本內容固定。若內容變更，需建立新修訂版。</p>
          <p className="muted">
            範圍：{preview.case.caseNo} 修訂 {preview.case.revisionNo}
          </p>
          <div className="button-row end">
            <button
              className="button secondary"
              type="button"
              onClick={() => dialog.current?.close()}
            >
              返回預覽
            </button>
            <button
              className="button primary"
              type="button"
              disabled={submitting}
              onClick={() => void issue()}
            >
              {submitting ? "正在核發…" : "確認核發"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
