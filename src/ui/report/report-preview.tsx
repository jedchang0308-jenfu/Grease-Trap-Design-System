"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RuntimeError, type UiProblem } from "@/ui/components/runtime-error";
import { StatusBadge } from "@/ui/components/status-badge";
import { fetchJson, UiRequestError } from "@/ui/lib/fetch-json";

interface Preview {
  snapshotHash: string;
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
  actors: { preparedBy: string; reviewedBy: string; issuedBy: string };
  html: string;
}

interface IssuedReport {
  id: string;
  reportNumber: string;
  snapshotHash: string;
  status: string;
  issuedAt: string;
  downloadUrl: string;
}

export function ReportPreview({ caseId }: { caseId: string }) {
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
          正在建立報告預覽，完成後會顯示核發範圍與下一步。
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
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="muted" style={{ marginBottom: 5 }}>
            {preview.case.caseNo}｜修訂 {preview.case.revisionNo}
          </p>
          <h1>報告預覽與核發</h1>
          <p className="lede">核發前確認完成軌、責任人與不可變快照。</p>
        </div>
        <div className="actions">
          <Link href={`/cases/${caseId}`}>返回案件</Link>
        </div>
      </header>
      {problem ? <RuntimeError problem={problem} /> : null}
      {issued ? (
        <div className="state-banner" style={{ marginBottom: 18 }}>
          <strong>報告已核發；此版本與快照不可修改。</strong>
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
            <dt>模式</dt>
            <dd>{preview.case.mode}</dd>
          </div>
          <div>
            <dt>完成軌</dt>
            <dd>
              {preview.assessments
                .filter((item) => item.status === "CALCULATED")
                .map((item) => item.track)
                .join("、")}
            </dd>
          </div>
          <div>
            <dt>狀態</dt>
            <dd>
              <StatusBadge
                status={issued ? "ISSUED" : preview.case.lifecycleStatus}
              />
            </dd>
          </div>
          <div>
            <dt>編製／覆核</dt>
            <dd>
              {preview.actors.preparedBy} / {preview.actors.reviewedBy}
            </dd>
          </div>
          <div>
            <dt>核發人</dt>
            <dd>{preview.actors.issuedBy}</dd>
          </div>
          <div>
            <dt>報告編號</dt>
            <dd>{issued?.reportNumber ?? preview.reportNumber}</dd>
          </div>
          <div>
            <dt>快照短碼</dt>
            <dd>
              <code>
                {(issued?.snapshotHash ?? preview.snapshotHash).slice(0, 12)}
              </code>
            </dd>
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
          title="設計計算書預覽"
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
          <p>核發後此版本與快照不可修改。若內容變更，需建立新修訂版。</p>
          <p className="muted">
            範圍：{preview.case.caseNo} 修訂 {preview.case.revisionNo}｜快照{" "}
            {preview.snapshotHash.slice(0, 12)}
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
