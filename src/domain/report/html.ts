import Decimal from "decimal.js";
import { basisForTrack, modeDisplayFor } from "../rules/source-display";
import {
  buildInputGroups,
  buildDesignResults,
  formulaValues,
  reportTracksForMode,
  type ReportInputGroup,
  type ReportOutputCell,
} from "./presentation";
import type { ReportSnapshotData, SnapshotRun } from "./types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const taskLabels: Record<string, string> = {
  T01_DINERS_TO_FLOW: "由每日用餐人數換算流量",
  T02_DINERS_TO_DESIGN: "由每日用餐人數規劃設計需求",
  T03_AREA_TO_FLOW: "由廚房與用餐區面積換算流量",
  T04_AREA_TO_DESIGN: "由廚房與用餐區面積規劃設計需求",
  T05_DESIGN_TO_DINERS_AND_AREA: "由設備能力反推可支援的人數與面積",
};

function formatNumber(value: string): string {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString("zh-TW", { maximumFractionDigits: 4 })
    : value;
}

function flowComparisonValue(unit: string, value: string): string {
  try {
    const original = new Decimal(value);
    const litersPerMinute = unit === "L/h" ? original.div(60) : original;
    return `${escapeHtml(formatNumber(litersPerMinute.toString()))} L/min`;
  } catch {
    return "";
  }
}

function formulaPurpose(formulaCode: string): string {
  if (formulaCode.startsWith("LEG-PERIOD-"))
    return "計算各餐期基礎處理水量（每小時）";
  const labels: Record<string, string> = {
    "CUR-DIN-Q": "計算設計處理水量（尖峰每分鐘）",
    "CUR-DIN-GU": "計算上游清除週期油脂量",
    "CUR-DIN-GB": "計算下游清除週期油脂量",
    "CUR-DIN-G": "合計清除週期油脂量",
    "CUR-AREA-A": "合計廚房與用餐區面積",
    "CUR-AREA-Q": "計算設計處理水量（尖峰每分鐘）",
    "CUR-AREA-GU": "計算上游清除週期油脂量",
    "CUR-AREA-GB": "計算下游清除週期油脂量",
    "CUR-AREA-G": "合計清除週期油脂量",
    "CUR-REV-N-Q": "依設計處理水量反推可支援人數",
    "CUR-REV-N-G": "依油脂容納能力反推可支援人數",
    "CUR-REV-A": "找出同時符合流量與油脂能力的最大面積",
    "LEG-MEAN-Q": "計算設計處理水量（各餐期平均、每小時）",
    "LEG-DIN-Q": "計算設計處理水量（每小時）",
    "LEG-MEASURED-Q": "依實測排水量計算設計處理水量（每小時）",
    "LEG-AREA-N": "依面積、人員密度與翻桌率估算人數",
    "LEG-VEFF": "計算設備所需有效容積",
    "LEG-REV-N": "依有效容積反推可支援人數",
    "LEG-REV-A": "依反推人數換算可支援面積",
  };
  return labels[formulaCode] ?? "依本計算依據公式計算";
}

function formatStepResult(value: string, unit: string): string {
  return `${escapeHtml(formatNumber(value))}${unit ? ` ${escapeHtml(unit)}` : ""}`;
}

const finalFlowFormulaCodes = new Set([
  "CUR-DIN-Q",
  "CUR-AREA-Q",
  "LEG-MEAN-Q",
  "LEG-DIN-Q",
  "LEG-MEASURED-Q",
]);

function stepComparisonValue(step: SnapshotRun["steps"][number]): string {
  if (!finalFlowFormulaCodes.has(step.formulaCode)) return "";
  return flowComparisonValue(step.unit, step.result);
}

function roleBadge(role: string): string {
  const className =
    role === "本案條件"
      ? "role-case"
      : role === "計算依據參數"
        ? "role-source"
        : "role-derived";
  return `<span class="role-badge ${className}">${escapeHtml(role)}</span>`;
}

function inputRows(
  group: ReportInputGroup,
  role?: ReportInputGroup["rows"][number]["role"],
): string {
  const rows = role
    ? group.rows.filter((row) => row.role === role)
    : group.rows;
  if (!rows.length) {
    return `<p class="empty-note">本次快照沒有可列出的輸入條件；報告不以 0 或推測值補齊。</p>`;
  }
  return `<table class="input-table"><thead><tr><th>條件</th><th>輸入值</th><th>資料角色</th></tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.label)}</td><td class="number-cell"><strong>${escapeHtml(row.value)}</strong>${row.unit ? ` <span class="unit">${escapeHtml(row.unit)}</span>` : ""}</td><td>${roleBadge(row.role)}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

function inputOverview(groups: ReportInputGroup[]): string {
  if (!groups.length) {
    return `<div class="empty-note">本次快照沒有可列出的輸入條件；報告不以 0 或推測值補齊。</div>`;
  }
  return `<div class="input-groups">${groups
    .map(
      (group) =>
        `<section class="input-group"><p class="group-source">計算依據</p><h3>${escapeHtml(group.sourceLabel)}</h3>${inputRows(group)}</section>`,
    )
    .join("")}</div>`;
}

function outputCell(cell: ReportOutputCell): string {
  if (cell.state === "NOT_COMPLETED")
    return `<span class="cell-state not-completed">未完成</span>`;
  if (cell.state === "NOT_APPLICABLE")
    return `<span class="cell-state not-applicable">此依據無法計算</span>`;
  return `<strong class="output-value">${escapeHtml(cell.value)}</strong>${cell.unit ? ` <span class="unit">${escapeHtml(cell.unit)}</span>` : ""}`;
}

function outputOverview(snapshot: ReportSnapshotData): string {
  const { tracks, rows } = buildDesignResults(
    snapshot.runs,
    snapshot.case.mode,
  );
  if (!rows.length)
    return `<div class="empty-note">本次尚無可列出的設計結果；報告不以 0 或推測值補齊。</div>`;
  return `<div class="table-scroll"><table class="output-table"><thead><tr><th>輸出項目</th>${tracks
    .map((track) => `<th>${escapeHtml(basisForTrack(track).shortLabel)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr><th>${escapeHtml(row.label)}</th>${tracks
          .map((track) => `<td>${outputCell(row.cells[track])}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function formulaValueTable(
  step: SnapshotRun["steps"][number],
  inputGroup: ReportInputGroup | undefined,
): string {
  const usesActualMinutes = inputGroup?.rows.some(
    (row) => row.label === "每日實際使用時間",
  );
  const values = formulaValues(step).map((value) =>
    inputGroup?.track === "CURRENT_QG" &&
    value.symbol === "t" &&
    usesActualMinutes
      ? { ...value, label: "每日實際使用時間", role: "本案條件" as const }
      : value,
  );
  if (!values.length)
    return `<p class="empty-note compact">本步驟沒有可列出的代入值。</p>`;
  return `<table class="formula-values"><thead><tr><th>符號</th><th>代表內容</th><th>數值</th><th>單位</th><th>資料角色</th></tr></thead><tbody>${values
    .map(
      (value) =>
        `<tr><td class="symbol">${escapeHtml(value.symbol)}</td><td>${escapeHtml(value.label)}</td><td class="number-cell"><strong>${escapeHtml(value.value)}</strong></td><td>${escapeHtml(value.unit || "—")}</td><td>${roleBadge(value.role)}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

function algorithmProcess(
  run: SnapshotRun,
  inputGroup: ReportInputGroup | undefined,
): string {
  const basis = basisForTrack(run.track);
  const methodInputs = inputGroup
    ? inputRows(inputGroup, "本案條件")
    : `<p class="empty-note">本次快照沒有可列出的輸入條件；報告不以 0 或推測值補齊。</p>`;
  if (!run.steps.length)
    return `<section class="algorithm-method"><span class="method-badge">${escapeHtml(basis.shortLabel)}</span><h3>計算依據：${escapeHtml(basis.fullLabel)}</h3><h4>本方法使用的條件</h4>${methodInputs}<p class="muted">目前沒有可列出的計算步驟。</p></section>`;
  return `<section class="algorithm-method"><span class="method-badge">${escapeHtml(basis.shortLabel)}</span><h3>計算依據：${escapeHtml(basis.fullLabel)}</h3><div class="method-inputs"><h4>本方法使用的條件</h4>${methodInputs}</div><ol class="algorithm-steps">${run.steps
    .map((step) => {
      const comparison = stepComparisonValue(step);
      return `<li class="algorithm-step"><span class="step-number">步驟 ${escapeHtml(step.sequence)}</span><div class="step-content"><p class="step-purpose">${escapeHtml(formulaPurpose(step.formulaCode))}</p><p class="step-line"><span class="step-label">公式</span><span class="step-expression">${escapeHtml(step.expression)}</span></p><div class="formula-block"><p class="step-label">代入內容</p>${formulaValueTable(step, inputGroup)}</div><p class="step-line"><span class="step-label">數值算式</span><span class="step-expression">${escapeHtml(step.substitution)}</span></p><p class="step-line step-result"><span class="step-label">計算結果</span><strong>${formatStepResult(step.result, step.unit)}</strong></p>${comparison ? `<p class="step-line step-comparison"><span class="step-label">統一比對值</span><strong>${comparison}</strong></p>` : ""}</div></li>`;
    })
    .join("")}</ol></section>`;
}

function missingWorkflowBanner(snapshot: ReportSnapshotData): string {
  if (snapshot.case.mode !== "DUAL_COMPARISON" || snapshot.runs.length !== 1)
    return "";
  const completed = snapshot.runs.map(
    (run) => basisForTrack(run.track).shortLabel,
  );
  const missing = reportTracksForMode(snapshot.case.mode)
    .filter((track) => !snapshot.runs.some((run) => run.track === track))
    .map((track) => basisForTrack(track).shortLabel);
  return `<div class="banner warning"><strong>本次只完成一份計算依據</strong><br>已完成：${escapeHtml(completed.join("、"))}。${missing.length ? `未完成：${escapeHtml(missing.join("、"))}；報告不會填入推測數字。` : ""}</div>`;
}

export function renderReportHtml(snapshot: ReportSnapshotData): string {
  const mode = modeDisplayFor(snapshot.case.mode);
  const task = taskLabels[snapshot.case.taskCode] ?? "設計需求計算";
  const inputGroups = buildInputGroups(
    snapshot.inputs,
    snapshot.runs.map((run) => run.track),
  );
  const groupForTrack = (track: string) =>
    inputGroups.find((group) => group.track === track);
  const overviewInputCount = inputGroups.reduce(
    (total, group) => total + group.rows.length,
    0,
  );
  const detailsClass = overviewInputCount <= 8 ? "page-break" : "";

  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><title>${escapeHtml(snapshot.reportNumber)} - ${escapeHtml(snapshot.case.title)}</title>
<style>
@page { size: A4; margin: 13mm 13mm 16mm; @bottom-center { content: "第 " counter(page) " 頁 / 共 " counter(pages) " 頁"; font-size: 9px; color: #66737c; } }
* { box-sizing: border-box; } body { margin: 0; color: #1f2d35; font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif; font-size: 9.5pt; line-height: 1.5; } p { margin: 0 0 3mm; }
h1 { font-size: 24pt; line-height: 1.18; margin: 0 0 3mm; color: #123d37; letter-spacing: .01em; } h2 { font-size: 17pt; line-height: 1.3; color: #123d37; border-bottom: 2px solid #a9c9c0; padding-bottom: 2mm; margin: 6mm 0 3mm; } h3 { font-size: 12pt; color: #1d4f47; margin: 2mm 0 2mm; } h4 { color: #1d4f47; margin: 3mm 0 2mm; font-size: 10pt; }
.eyebrow { color: #5d756e; letter-spacing: .08em; font-size: 8.5pt; font-weight: 800; } .document-number { color: #53646b; font: 9pt Consolas, monospace; margin-bottom: 3mm; }
.summary { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #b9c8cc; margin: 4mm 0; } .summary div { padding: 2mm 3mm; border-bottom: 1px solid #dce3e5; } .summary div:nth-last-child(-n+2) { border-bottom: 0; } .summary dt { font-size: 8pt; color: #66737c; } .summary dd { margin: .5mm 0 0; font-weight: 700; } .summary dd small { display: block; color: #65756f; font-weight: 400; font-size: 8pt; }
.flow-strip { display: grid; grid-template-columns: 1fr 1fr 1fr; margin: 4mm 0 5mm; border: 1px solid #b8cec8; background: #f6faf8; } .flow-step { position: relative; padding: 3mm 4mm; min-height: 17mm; } .flow-step + .flow-step { border-left: 1px solid #b8cec8; } .flow-step + .flow-step::before { content: "→"; position: absolute; left: -3.2mm; top: 5.3mm; width: 6mm; text-align: center; color: #287365; background: #f6faf8; font-weight: 800; } .flow-step span { display: block; color: #61736e; font-size: 7.5pt; } .flow-step strong { display: block; color: #174b43; margin-top: .5mm; }
.banner { border-left: 4px solid #167064; background: #edf7f3; padding: 3mm 4mm; margin: 4mm 0; break-inside: avoid; } .banner.warning { border-color: #bd7621; background: #fff5e4; }
.input-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3mm; } .input-group { border: 1px solid #c8d6d4; padding: 3mm; break-inside: avoid; } .input-groups > .input-group:only-child { grid-column: 1 / -1; } .group-source { color: #66737c; font-size: 7.5pt; font-weight: 800; margin: 0; }
table { width: 100%; border-collapse: collapse; } th, td { border-bottom: 1px solid #d9e3e1; padding: 1.6mm 2mm; text-align: left; vertical-align: top; } thead th { color: #526862; font-size: 7.5pt; background: #f1f6f4; } tbody tr:last-child > * { border-bottom: 0; } .input-table { font-size: 8.2pt; } .input-table th:nth-child(1) { width: 38%; } .input-table th:nth-child(2) { width: 32%; } .number-cell { white-space: nowrap; } .unit { color: #596e68; font-size: .9em; white-space: nowrap; }
.role-badge { display: inline-block; border-radius: 99px; padding: .4mm 1.5mm; font-size: 7pt; font-weight: 800; white-space: nowrap; } .role-case { color: #1d5a50; background: #e5f3ef; } .role-source { color: #70511d; background: #fff1d4; } .role-derived { color: #495d79; background: #eaf0f8; }
.result-section { break-inside: avoid; } .table-scroll { border: 1px solid #b7c9c5; break-inside: avoid; } .output-table th, .output-table td { padding: 1.6mm 2.5mm; } .output-table thead th { font-size: 8pt; } .output-table tbody th { color: #435c56; width: 34%; background: #f8faf9; } .output-value { color: #123d37; font-size: 11pt; } .cell-state { font-size: 8pt; font-weight: 800; } .not-completed { color: #8a4b08; } .not-applicable { color: #6d777b; }
.empty-note { color: #6b7478; background: #f6f8f8; border-left: 3px solid #a8b4b8; padding: 2mm 3mm; margin: 2mm 0; } .empty-note.compact { font-size: 8pt; }
.page-break { break-before: page; } .comparison-guide { color: #465d59; background: #f3f8f5; border-left: 4px solid #348678; padding: 2.5mm 3mm; margin: 0 0 4mm; font-size: 8.5pt; } .muted { color: #65747b; font-size: 8.5pt; }
.method-badge { display: inline-block; padding: 1mm 2.5mm; border-radius: 99px; background: #e7f0ed; color: #2d6258; font-size: 8pt; font-weight: 800; } .algorithm-method { margin: 4mm 0 6mm; } .algorithm-method + .algorithm-method { border-top: 2px solid #a9c9c0; padding-top: 5mm; } .method-inputs { break-inside: avoid; margin-bottom: 4mm; } .method-inputs .input-table { border: 1px solid #d5e0de; }
.algorithm-steps { list-style: none; margin: 2mm 0 0; padding: 0; } .algorithm-step { display: grid; grid-template-columns: 17mm 1fr; gap: 2mm; border-top: 1px solid #d8e2e1; padding: 2mm 0; break-inside: avoid; } .step-number { color: #2d6258; font-size: 8pt; font-weight: 800; padding-top: 1mm; } .step-content { min-width: 0; } .step-purpose { color: #1d4f47; font-weight: 800; margin: 0 0 1mm; } .step-line { display: grid; grid-template-columns: 19mm 1fr; gap: 2mm; margin: 0 0 .6mm; font-size: 8.5pt; } .step-label { color: #66737c; font-weight: 700; } .step-expression { color: #32464d; overflow-wrap: anywhere; } .formula-block { margin: 1mm 0; } .formula-block > .step-label { display: block; margin-bottom: .6mm; } .formula-values { border: 1px solid #d9e3e1; font-size: 7.7pt; } .formula-values th, .formula-values td { padding: 1mm 1.5mm; } .formula-values .symbol { color: #1d4f47; font-family: Consolas, monospace; font-weight: 800; } .step-result { color: #123d37; font-weight: 800; margin-top: .6mm; } .step-comparison { color: #1d5a50; background: #edf7f3; padding: .8mm 1.5mm; margin-top: .6mm; }
</style></head><body>
<section class="overview"><p class="eyebrow">鉦富機械有限公司 / 客戶設計計算報告</p><h1>油脂截留器設計計算報告</h1><p class="document-number">文件編號：${escapeHtml(snapshot.reportNumber)}</p><dl class="summary"><div><dt>案件</dt><dd>${escapeHtml(snapshot.case.caseNo)} / 修訂 ${escapeHtml(snapshot.case.revisionNo)}</dd></div><div><dt>客戶</dt><dd>${escapeHtml(snapshot.case.customer)}</dd></div><div><dt>設置地點</dt><dd>${escapeHtml(snapshot.case.location)}</dd></div><div><dt>需求目的</dt><dd>${escapeHtml(task)}</dd></div><div><dt>計算依據</dt><dd>${escapeHtml(mode.label)}<small>${escapeHtml(mode.description)}</small></dd></div></dl><div class="flow-strip"><div class="flow-step"><span>01 輸入</span><strong>本次輸入條件</strong></div><div class="flow-step"><span>02 計算</span><strong>${escapeHtml(mode.label)}</strong></div><div class="flow-step"><span>03 輸出</span><strong>本次設計結果</strong></div></div>${missingWorkflowBanner(snapshot)}<h2>本次輸入條件</h2>${inputOverview(inputGroups)}<div class="result-section"><h2>本次設計結果</h2>${outputOverview(snapshot)}</div></section>
<section class="${detailsClass}"><h2>完整計算過程</h2><p class="comparison-guide">設計處理水量統一換算為 L/min 方便比對；來源公式的原始單位仍完整保留。清除週期油脂量使用 kg，有效容積使用 L，兩者用途不同，不互相比較。</p>${snapshot.runs.map((run) => algorithmProcess(run, groupForTrack(run.track))).join("")}</section>
</body></html>`;
}
