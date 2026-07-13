import type { ReportSnapshotData, SnapshotRun } from "./types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const resultLabels: Record<string, string> = {
  qLpm: "流量 Q (L/min)",
  gKg: "油脂量 G (kg)",
  qLph: "流量 Q (L/h)",
  effectiveVolumeL: "有效容積 Veff (L)",
  dinersEquivalentMax: "等效人數上限 (人)",
  areaEquivalentMaxM2: "等效面積上限 (m2)",
};

function resultsTable(run: SnapshotRun) {
  const rows = Object.entries(run.adopted)
    .filter(([, value]) => value !== null)
    .map(
      ([key, value]) =>
        `<tr><th>${escapeHtml(resultLabels[key] ?? key)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  return `<table class="data-table"><tbody>${rows}</tbody></table>`;
}

function stepsTable(run: SnapshotRun) {
  const rows = run.steps
    .map(
      (item) =>
        `<tr><td>${item.sequence}</td><td>${escapeHtml(item.formulaCode)}</td><td>${escapeHtml(item.expression)}</td><td>${escapeHtml(item.substitution)}</td><td>${escapeHtml(item.result)} ${escapeHtml(item.unit)}</td><td>${escapeHtml(item.sourceRef)}</td></tr>`,
    )
    .join("");
  return `<table class="steps"><thead><tr><th>#</th><th>步驟</th><th>公式</th><th>代入</th><th>結果</th><th>來源</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderReportHtml(snapshot: ReportSnapshotData): string {
  const completedTracks = snapshot.runs.map((run) =>
    run.track === "CURRENT_QG" ? "現行 Q/G" : "舊版 Q/V",
  );
  const isSingleTrackDual =
    snapshot.case.mode === "DUAL_COMPARISON" && snapshot.runs.length === 1;
  const assessmentSections = snapshot.assessments
    .filter(
      (assessment) =>
        !snapshot.runs.some((run) => run.track === assessment.track),
    )
    .map(
      (assessment) =>
        `<section class="track missing"><h2>${assessment.track === "CURRENT_QG" ? "現行 Q/G" : "舊版 Q/V"}</h2><p class="missing-label">未計算</p><p>${escapeHtml(assessment.errors[0] ?? assessment.releaseRelevance)}</p></section>`,
    )
    .join("");
  const runSections = snapshot.runs
    .map(
      (run) =>
        `<section class="track"><h2>${run.track === "CURRENT_QG" ? "現行 Q/G" : "舊版 Q/V (歷史指引方法)"}</h2><p>${escapeHtml(run.semantics)}</p>${resultsTable(run)}<h3>計算過程</h3>${stepsTable(run)}<p class="source">規則：${escapeHtml(run.ruleSet.code)} ${escapeHtml(run.ruleSet.version)} / checksum ${escapeHtml(run.ruleSet.checksum)}<br>來源：${escapeHtml(run.ruleSet.sourceTitle)} / SHA-256 ${escapeHtml(run.ruleSet.sourceHash)}</p></section>`,
    )
    .join("");
  const overrideRows = snapshot.overrides.length
    ? snapshot.overrides
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.resultPath)}</td><td>${escapeHtml(item.beforeValue)}</td><td>${escapeHtml(item.afterValue)}</td><td>${escapeHtml(item.reason)}</td><td>${escapeHtml(item.evidence)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="5">無人工採用紀錄。</td></tr>`;

  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><title>${escapeHtml(snapshot.reportNumber)} - ${escapeHtml(snapshot.case.title)}</title>
<style>
@page { size: A4; margin: 16mm 15mm 18mm; @bottom-center { content: "第 " counter(page) " 頁 / 共 " counter(pages) " 頁"; font-size: 9px; color: #58636d; } }
* { box-sizing: border-box; } body { margin: 0; color: #17212b; font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif; font-size: 10.5pt; line-height: 1.55; }
h1 { font-size: 25pt; line-height: 1.2; margin: 0 0 12mm; color: #12332f; } h2 { font-size: 16pt; color: #12332f; border-bottom: 2px solid #aac4bd; padding-bottom: 3mm; margin: 9mm 0 4mm; } h3 { font-size: 12pt; margin: 6mm 0 3mm; }
.cover { min-height: 245mm; display: flex; flex-direction: column; justify-content: center; } .eyebrow { color: #5a6b67; letter-spacing: .08em; font-size: 9pt; font-weight: 700; } .report-number { font: 11pt Consolas, monospace; padding: 3mm 4mm; background: #edf3f1; display: inline-block; }
.summary { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #b9c5ca; margin: 8mm 0; } .summary div { padding: 3mm 4mm; border-bottom: 1px solid #d8dfe3; } .summary dt { font-size: 8.5pt; color: #5c6872; } .summary dd { margin: 1mm 0 0; font-weight: 700; }
.banner { border-left: 4px solid #075e54; background: #edf6f3; padding: 4mm; margin: 5mm 0; } .banner.warning { border-color: #b56813; background: #fff5e3; }
table { width: 100%; border-collapse: collapse; margin: 3mm 0 5mm; break-inside: avoid; } th, td { border: 1px solid #bfc9cf; padding: 2.2mm 2.5mm; text-align: left; vertical-align: top; } th { background: #eef2f4; }
.data-table th { width: 52%; } .steps { font-size: 8.2pt; table-layout: fixed; } .steps th:nth-child(1) { width: 5%; } .steps th:nth-child(2) { width: 14%; } .steps th:nth-child(3) { width: 19%; } .steps th:nth-child(4) { width: 25%; } .steps th:nth-child(5) { width: 18%; } .steps td { overflow-wrap: anywhere; }
.track { break-before: page; } .track:first-of-type { break-before: auto; } .missing { border: 1px dashed #b6782e; padding: 5mm; } .missing-label { font-weight: 800; color: #8a4b08; }
.source { font-size: 8.2pt; color: #5c6872; overflow-wrap: anywhere; } .signature { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; margin-top: 12mm; } .signature div { min-height: 28mm; border-top: 1px solid #7d8991; padding-top: 2mm; }
.page-break { break-before: page; } .limitation { border: 2px solid #7e4f18; padding: 5mm; background: #fff8ec; font-weight: 700; }
</style></head><body>
<section class="cover"><p class="eyebrow">鉦富機械有限公司 / 內部工程覆核文件</p><h1>油脂截留器設計計算書</h1><p class="report-number">${escapeHtml(snapshot.reportNumber)}</p><dl class="summary"><div><dt>案件</dt><dd>${escapeHtml(snapshot.case.caseNo)} / 修訂 ${snapshot.case.revisionNo}</dd></div><div><dt>客戶</dt><dd>${escapeHtml(snapshot.case.customer)}</dd></div><div><dt>地點</dt><dd>${escapeHtml(snapshot.case.location)}</dd></div><div><dt>計算模式</dt><dd>${escapeHtml(snapshot.case.mode)}</dd></div><div><dt>案件名稱</dt><dd>${escapeHtml(snapshot.case.title)}</dd></div><div><dt>計算狀態</dt><dd>${escapeHtml(snapshot.case.calculationStatus)}</dd></div></dl>${isSingleTrackDual ? `<div class="banner warning"><strong>雙軌案件 - 單軌完成</strong><br>本次完成：${escapeHtml(completedTracks.join("、"))}；未完成軌不影響本次工程覆核與核發。</div>` : `<div class="banner"><strong>計算已完成並通過工程覆核。</strong><br>完成軌：${escapeHtml(completedTracks.join("、"))}</div>`}</section>
<section class="page-break"><h2>一頁結論</h2><dl class="summary"><div><dt>任務</dt><dd>${escapeHtml(snapshot.case.taskCode)}</dd></div><div><dt>模式</dt><dd>${escapeHtml(snapshot.case.mode)}</dd></div><div><dt>編製</dt><dd>${escapeHtml(snapshot.actors.preparedBy)}</dd></div><div><dt>覆核／核發</dt><dd>${escapeHtml(snapshot.actors.reviewedBy)} / ${escapeHtml(snapshot.actors.issuedBy)}</dd></div></dl>${snapshot.runs.map((run) => `<h3>${run.track === "CURRENT_QG" ? "現行 Q/G" : "舊版 Q/V"}</h3>${resultsTable(run)}`).join("")}<div class="limitation">${escapeHtml(snapshot.limitation)}</div></section>
${runSections}${assessmentSections}
<section class="page-break"><h2>人工採用與覆核</h2><table><thead><tr><th>結果路徑</th><th>前值</th><th>後值</th><th>工程理由</th><th>依據</th></tr></thead><tbody>${overrideRows}</tbody></table><h3>覆核紀錄</h3><p>決策：${escapeHtml(snapshot.review.decision)}<br>覆核時間：${escapeHtml(snapshot.review.reviewedAt)}<br>備註：${escapeHtml(snapshot.review.note || "無")}</p><div class="signature"><div>編製：${escapeHtml(snapshot.actors.preparedBy)}</div><div>覆核：${escapeHtml(snapshot.actors.reviewedBy)}</div><div>核發：${escapeHtml(snapshot.actors.issuedBy)}</div></div></section>
<section class="page-break"><h2>限制與來源聲明</h2><p class="limitation">${escapeHtml(snapshot.limitation)}</p><p>本計算書保存案件輸入、規則版本、來源雜湊、raw 結果、正式採用值、覆核清單與快照雜湊。舊版 Q/V 章節若存在，僅代表歷史指引方法，不能取代現行 Q/G 設計語意。</p><p class="source">Snapshot schema: ${escapeHtml(snapshot.schemaVersion)}</p></section>
</body></html>`;
}
