import { readFileSync } from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import { basisForTrack, modeDisplayFor } from "../rules/source-display";
import {
  buildInputGroups,
  buildInputCompletenessBadges,
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

function cssString(value: unknown): string {
  return JSON.stringify(String(value ?? "").replace(/<\/style/gi, "<\\/style"));
}

let jenfuLogoDataUriCache: string | null | undefined;

function jenfuLogoDataUri(): string {
  if (jenfuLogoDataUriCache !== undefined) return jenfuLogoDataUriCache ?? "";
  try {
    const logoPath = path.join(process.cwd(), "public", "jenfu-logo-small.png");
    const logo = readFileSync(logoPath);
    jenfuLogoDataUriCache = `data:image/png;base64,${logo.toString("base64")}`;
  } catch {
    jenfuLogoDataUriCache = null;
  }
  return jenfuLogoDataUriCache ?? "";
}

function logoMarkup(className: string): string {
  const logo = jenfuLogoDataUri();
  if (!logo) return `<span class="${className} logo-fallback">JF</span>`;
  return `<img class="${className}" alt="鉦富機械有限公司" src="${logo}">`;
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
  const className = ["案件資料", "本案條件", "設備資料", "實測資料"].includes(
    role,
  )
    ? "role-case"
    : ["工程選值", "法規表值", "計算依據參數", "覆寫值"].includes(role)
      ? "role-source"
      : "role-derived";
  return `<span class="role-badge ${className}">${escapeHtml(role)}</span>`;
}

function conditionBadgeStrip(
  badges: ReturnType<typeof buildInputCompletenessBadges>,
): string {
  if (!badges.length) return "";
  return `<div class="condition-badges">${badges
    .map(
      (badge) =>
        `<span class="condition-badge ${escapeHtml(badge.tone)}">${escapeHtml(badge.label)}${badge.detail ? `<small>${escapeHtml(badge.detail)}</small>` : ""}</span>`,
    )
    .join("")}</div>`;
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
  return `<table class="input-table"><thead><tr><th>條件</th><th>輸入值</th><th>類型</th><th>來源/理由</th></tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.label)}</td><td class="number-cell"><strong>${escapeHtml(row.value)}</strong>${row.unit ? ` <span class="unit">${escapeHtml(row.unit)}</span>` : ""}</td><td>${roleBadge(row.role)}</td><td>${escapeHtml(row.sourceNote ?? "—")}</td></tr>`,
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
  return `<p class="result-guide"><strong>下表顯示正式採用值。</strong>完整計算過程另列未取整原始值及其單位換算，因此兩處數字可能不同。</p><div class="table-scroll"><table class="output-table"><thead><tr><th>輸出項目</th>${tracks
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
      ? { ...value, label: "每日實際使用時間", role: "覆寫值" as const }
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
    ? inputRows(inputGroup)
    : `<p class="empty-note">本次快照沒有可列出的輸入條件；報告不以 0 或推測值補齊。</p>`;
  if (!run.steps.length)
    return `<section class="algorithm-method"><span class="method-badge">${escapeHtml(basis.shortLabel)}</span><h3>計算依據：${escapeHtml(basis.fullLabel)}</h3><h4>本方法使用的條件</h4>${methodInputs}<p class="muted">目前沒有可列出的計算步驟。</p></section>`;
  return `<section class="algorithm-method"><span class="method-badge">${escapeHtml(basis.shortLabel)}</span><h3>計算依據：${escapeHtml(basis.fullLabel)}</h3><div class="method-inputs"><h4>本方法使用的條件</h4>${methodInputs}</div><ol class="algorithm-steps">${run.steps
    .map((step) => {
      const comparison = stepComparisonValue(step);
      return `<li class="algorithm-step"><span class="step-number">步驟 ${escapeHtml(step.sequence)}</span><div class="step-content"><p class="step-purpose">${escapeHtml(formulaPurpose(step.formulaCode))}</p><p class="step-line"><span class="step-label">公式</span><span class="step-expression">${escapeHtml(step.expression)}</span></p><div class="formula-block"><p class="step-label">代入內容</p>${formulaValueTable(step, inputGroup)}</div><p class="step-line"><span class="step-label">數值算式</span><span class="step-expression">${escapeHtml(step.substitution)}</span></p><p class="step-line step-result"><span class="step-label">計算結果</span><strong>${formatStepResult(step.result, step.unit)}</strong></p>${comparison ? `<p class="step-line step-comparison"><span class="step-label">原始值換算（未取整）</span><strong>${comparison}</strong></p>` : ""}</div></li>`;
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
  const reportTitle = "油脂截留器設計計算報告";
  const versionLabel = `修訂 ${snapshot.case.revisionNo}`;
  const preparedBy = snapshot.actors.preparedBy;
  const footerLogo = jenfuLogoDataUri();
  const footerLogoRule = footerLogo
    ? `background-image: url("${footerLogo}"); background-repeat: no-repeat; background-position: right 28mm center; background-size: 3.2mm auto;`
    : "";
  const inputGroups = buildInputGroups(
    snapshot.inputs,
    snapshot.runs.map((run) => run.track),
  );
  const conditionBadges = buildInputCompletenessBadges(
    snapshot.inputs,
    snapshot.runs.map((run) => run.track),
    snapshot.case.mode,
  );
  const groupForTrack = (track: string) =>
    inputGroups.find((group) => group.track === track);
  const overviewInputCount = inputGroups.reduce(
    (total, group) => total + group.rows.length,
    0,
  );
  const detailsClass = overviewInputCount <= 8 ? "page-break" : "";

  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><title>${escapeHtml(snapshot.reportNumber)} - ${escapeHtml(reportTitle)}</title>
<style>
@page cover { size: A4; margin: 12.7mm; @top-center { content: none; } @bottom-center { content: none; } @bottom-right { content: none; } }
@page report { size: A4; margin: 12.7mm 12.7mm 18mm; @top-left { content: ${cssString(reportTitle)}; font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif; font-size: 9pt; color: #777; text-align: left; vertical-align: bottom; border-bottom: 1.5pt solid #4472C4; padding-bottom: 1mm; } @top-center { content: "報告編號：" ${cssString(snapshot.reportNumber)}; font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif; font-size: 9pt; color: #777; text-align: center; vertical-align: bottom; border-bottom: 1.5pt solid #4472C4; padding-bottom: 1mm; } @top-right { content: "版次：" ${cssString(versionLabel)}; font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif; font-size: 9pt; color: #777; text-align: left; vertical-align: bottom; border-bottom: 1.5pt solid #4472C4; padding-bottom: 1mm; } @bottom-left-corner { content: ""; width: 7mm; height: 7mm; border-top: .7pt solid #9A9A9A; border-left: .7pt solid #9A9A9A; } @bottom-center { content: "頁次 " counter(page) " / " counter(pages); font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif; font-size: 9pt; color: #777; } @bottom-right { content: "鉦富機械有限公司"; ${footerLogoRule} font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif; font-size: 10pt; font-weight: 700; color: #777; text-align: right; white-space: nowrap; } @bottom-right-corner { content: ""; width: 7mm; height: 7mm; border-top: .7pt solid #9A9A9A; border-right: .7pt solid #9A9A9A; } }
* { box-sizing: border-box; }
body { margin: 0; color: #111; background: #fff; font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif; font-size: 12pt; line-height: 1.45; }
p { margin: 0 0 3mm; }
.cover-page { page: cover; min-height: calc(297mm - 25.4mm); display: flex; flex-direction: column; page-break-after: always; }
.cover-brand { margin-top: 37mm; text-align: center; }
.jenfu-logo { display: block; object-fit: contain; }
.cover-logo { width: 18mm; height: auto; margin: 0 auto 5mm; }
.logo-fallback { display: inline-flex; align-items: center; justify-content: center; width: 18mm; height: 22mm; border: 1.5pt solid #4472C4; color: #4472C4; font-weight: 700; }
.cover-company-cn { font-size: 28pt; font-weight: 700; line-height: 1.1; }
.cover-company-en { margin-top: 2mm; font-size: 14pt; font-weight: 700; line-height: 1.2; }
.cover-title { margin: 35mm 0 0; color: #111; text-align: center; font-size: 28pt; font-weight: 700; line-height: 1.2; letter-spacing: 0; }
.cover-spacer { flex: 1; }
.cover-meta { margin: 0 4mm 12mm; }
.cover-meta-strip { height: 7mm; background: #DAE3F3; }
.cover-meta-body { background: #4472C4; color: #fff; padding: 7mm 12mm; font-size: 18pt; line-height: 1.7; }
.cover-meta-body p { margin: 0; }
.report-body { page: report; }
.screen-report-header, .screen-report-footer { display: none; }
h2 { margin: 6mm 0 3mm; padding: 0 0 1.4mm 2.4mm; border-left: 2.4mm solid #4472C4; border-bottom: .6pt solid #B8C0CC; color: #111; font-size: 14pt; line-height: 1.3; }
h3 { margin: 3mm 0 2mm; color: #111; font-size: 12pt; line-height: 1.35; }
h4 { margin: 3mm 0 2mm; color: #111; font-size: 10.5pt; line-height: 1.35; }
.eyebrow { margin-bottom: 2mm; color: #4472C4; font-size: 9pt; font-weight: 700; letter-spacing: 0; }
.document-number { color: #333; font: 9pt Consolas, monospace; margin-bottom: 3mm; }
.summary-table { margin: 3mm 0 5mm; }
.summary-table th { width: 24mm; background: #F2F2F2; color: #111; text-align: center; white-space: nowrap; }
.summary-table td { width: 40%; font-weight: 700; }
.summary-table small { display: block; margin-top: .5mm; color: #555; font-weight: 400; font-size: 8pt; }
.flow-strip { display: grid; grid-template-columns: 1fr 1fr 1fr; margin: 4mm 0 5mm; border: 1px solid #7f7f7f; background: #fff; break-inside: avoid; }
.flow-step { position: relative; min-height: 16mm; padding: 3mm 4mm; }
.flow-step + .flow-step { border-left: 1px solid #7f7f7f; }
.flow-step + .flow-step::before { content: "→"; position: absolute; left: -3.2mm; top: 5.2mm; width: 6mm; background: #fff; color: #4472C4; text-align: center; font-weight: 700; }
.flow-step span { display: block; color: #555; font-size: 8pt; }
.flow-step strong { display: block; margin-top: .5mm; color: #111; font-size: 10pt; }
.banner { margin: 4mm 0; padding: 3mm 4mm; border: 1px solid #4472C4; border-left-width: 4px; background: #F8FAFF; break-inside: avoid; }
.banner.warning { border-color: #BD7621; background: #FFF8ED; }
.condition-badges { display: flex; flex-wrap: wrap; gap: 2mm; margin: 0 0 3mm; }
.condition-badge { display: inline-flex; flex-direction: column; gap: .4mm; border: 1px solid #9fb3d8; border-radius: 2mm; padding: 1.2mm 2.2mm; background: #F8FAFF; color: #1f1f1f; font-size: 8pt; font-weight: 700; }
.condition-badge small { color: #555; font-size: 7pt; font-weight: 400; }
.condition-badge.warning { border-color: #D6A45D; background: #FFF8ED; color: #623B08; }
.condition-badge.info { border-color: #9FB3D8; background: #F8FAFF; color: #26496F; }
.input-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3mm; }
.input-group { padding: 0; break-inside: avoid; }
.input-groups > .input-group:only-child { grid-column: 1 / -1; }
.group-source { margin: 0 0 1mm; color: #555; font-size: 8pt; font-weight: 700; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: 1px solid #7f7f7f; padding: 1.6mm 2mm; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
thead th { background: #F2F2F2; color: #111; font-size: 8pt; font-weight: 700; text-align: center; }
.input-table { font-size: 8.2pt; }
.input-table th:nth-child(1) { width: 34%; }
.input-table th:nth-child(2) { width: 28%; }
.input-table th:nth-child(3) { width: 18%; }
.number-cell { white-space: nowrap; }
.unit { color: #444; font-size: .9em; white-space: nowrap; }
.role-badge { display: inline-block; border: 1px solid #9FB3D8; border-radius: 2mm; padding: .3mm 1.3mm; background: #F8FAFF; color: #1f1f1f; font-size: 7pt; font-weight: 700; white-space: nowrap; }
.role-case { border-color: #9FB3D8; }
.role-source { border-color: #D6A45D; background: #FFF8ED; }
.role-derived { border-color: #9FB3D8; }
.result-section { break-inside: avoid; }
.result-guide { margin: 0 0 2mm; color: #333; font-size: 8.5pt; }
.result-guide strong { color: #111; margin-right: 1mm; }
.table-scroll { border: 0; break-inside: avoid; }
.output-table th, .output-table td { padding: 1.8mm 2.5mm; }
.output-table thead th { font-size: 8.5pt; }
.output-table tbody th { width: 34%; background: #F2F2F2; color: #111; }
.output-value { color: #111; font-size: 11pt; }
.cell-state { font-size: 8pt; font-weight: 700; }
.not-completed { color: #8a4b08; }
.not-applicable { color: #555; }
.empty-note { margin: 2mm 0; padding: 2mm 3mm; border: 1px solid #BFBFBF; border-left: 4px solid #A6A6A6; background: #F7F7F7; color: #555; }
.empty-note.compact { font-size: 8pt; }
.page-break { break-before: page; }
.comparison-guide { margin: 0 0 4mm; padding: 2.5mm 3mm; border: 1px solid #9FB3D8; border-left: 4px solid #4472C4; background: #F8FAFF; color: #333; font-size: 8.5pt; }
.muted { color: #555; font-size: 8.5pt; }
.method-badge { display: inline-block; padding: 1mm 2.5mm; border: 1px solid #9FB3D8; border-radius: 2mm; background: #F8FAFF; color: #111; font-size: 8pt; font-weight: 700; }
.algorithm-method { margin: 4mm 0 6mm; }
.algorithm-method + .algorithm-method { padding-top: 5mm; border-top: 1.5pt solid #4472C4; }
.method-inputs { margin-bottom: 4mm; break-inside: avoid; }
.algorithm-steps { list-style: none; margin: 2mm 0 0; padding: 0; }
.algorithm-step { display: grid; grid-template-columns: 17mm 1fr; gap: 2mm; padding: 2mm 0; border-top: 1px solid #BFBFBF; break-inside: avoid; }
.step-number { padding-top: 1mm; color: #4472C4; font-size: 8pt; font-weight: 700; }
.step-content { min-width: 0; }
.step-purpose { margin: 0 0 1mm; color: #111; font-weight: 700; }
.step-line { display: grid; grid-template-columns: 19mm 1fr; gap: 2mm; margin: 0 0 .6mm; font-size: 8.5pt; }
.step-label { color: #555; font-weight: 700; }
.step-expression { color: #111; overflow-wrap: anywhere; }
.formula-block { margin: 1mm 0; }
.formula-block > .step-label { display: block; margin-bottom: .6mm; }
.formula-values { font-size: 7.7pt; }
.formula-values th, .formula-values td { padding: 1mm 1.5mm; }
.formula-values .symbol { color: #111; font-family: Consolas, monospace; font-weight: 700; }
.step-result { color: #111; font-weight: 700; margin-top: .6mm; }
.step-comparison { margin-top: .6mm; padding: .8mm 1.5mm; border: 1px solid #9FB3D8; background: #F8FAFF; color: #111; }
@media screen { body { background: #E9EDF3; padding: 8mm 0; } .cover-page, .report-body { width: 210mm; margin: 0 auto 8mm; background: #fff; box-shadow: 0 0 0 1px #d9dfe8; } .cover-page { padding: 12.7mm; } .report-body { padding: 8mm 12.7mm 14mm; } .screen-report-header { display: grid; grid-template-columns: 1fr 1.3fr .7fr; column-gap: 6mm; align-items: end; margin: 0 0 7mm; padding-bottom: 1mm; border-bottom: 1.5pt solid #4472C4; color: #777; font-size: 9pt; } .screen-report-header span:nth-child(2) { text-align: center; } .screen-report-footer { position: relative; display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: center; min-height: 10mm; margin-top: 12mm; color: #777; font-size: 9pt; } .screen-report-footer::before, .screen-report-footer::after { content: ""; position: absolute; bottom: 0; width: 8mm; height: 8mm; border-top: .7pt solid #9A9A9A; } .screen-report-footer::before { left: -6mm; border-left: .7pt solid #9A9A9A; } .screen-report-footer::after { right: -6mm; border-right: .7pt solid #9A9A9A; } .screen-footer-page { text-align: center; } .screen-footer-brand { display: inline-flex; grid-column: 3; align-items: center; justify-content: flex-end; gap: 1.3mm; font-size: 10pt; font-weight: 700; } .screen-footer-logo { width: 3.2mm; height: auto; } }
@media print { .screen-report-header, .screen-report-footer { display: none; } }
</style></head><body>
<section class="cover-page"><div class="cover-brand">${logoMarkup("jenfu-logo cover-logo")}<div class="cover-company-cn">鉦富機械有限公司</div><div class="cover-company-en">Jenfu Machinery Co., LTD</div></div><h1 class="cover-title">${escapeHtml(reportTitle)}</h1><div class="cover-spacer"></div><div class="cover-meta"><div class="cover-meta-strip"></div><div class="cover-meta-body"><p>編號：${escapeHtml(snapshot.reportNumber)}</p><p>版次：${escapeHtml(versionLabel)}</p><p>制定者：${escapeHtml(preparedBy)}</p><p>修訂日：</p></div></div></section>
<main class="report-body"><div class="screen-report-header"><span>${escapeHtml(reportTitle)}</span><span>報告編號：${escapeHtml(snapshot.reportNumber)}</span><span>版次：${escapeHtml(versionLabel)}</span></div><section class="overview"><h2>案件資料</h2><p class="document-number">文件編號：${escapeHtml(snapshot.reportNumber)}</p><table class="summary-table"><tbody><tr><th>案件</th><td>${escapeHtml(snapshot.case.caseNo)} / ${escapeHtml(versionLabel)}</td><th>客戶</th><td>${escapeHtml(snapshot.case.customer)}</td></tr><tr><th>設置地點</th><td>${escapeHtml(snapshot.case.location)}</td><th>需求目的</th><td>${escapeHtml(task)}</td></tr><tr><th>計算依據</th><td colspan="3">${escapeHtml(mode.label)}<small>${escapeHtml(mode.description)}</small></td></tr></tbody></table><div class="flow-strip"><div class="flow-step"><span>01 輸入</span><strong>本次輸入條件</strong></div><div class="flow-step"><span>02 計算</span><strong>${escapeHtml(mode.label)}</strong></div><div class="flow-step"><span>03 輸出</span><strong>本次設計結果</strong></div></div>${missingWorkflowBanner(snapshot)}<h2>本次輸入條件</h2>${conditionBadgeStrip(conditionBadges)}${inputOverview(inputGroups)}<div class="result-section"><h2>本次設計結果</h2>${outputOverview(snapshot)}</div></section>
<section class="${detailsClass}"><h2>完整計算過程</h2><p class="comparison-guide">本區保留未取整原始值；設計處理水量另列「原始值換算（未取整）」的 L/min 數值方便比對。正式採用值依規則取整，請以「本次設計結果」為準。清除週期油脂量使用 kg，有效容積使用 L，兩者用途不同，不互相比較。</p>${snapshot.runs.map((run) => algorithmProcess(run, groupForTrack(run.track))).join("")}</section><div class="screen-report-footer"><span></span><span class="screen-footer-page">頁次 -- / --</span><span class="screen-footer-brand">${logoMarkup("screen-footer-logo")}鉦富機械有限公司</span></div></main>
</body></html>`;
}
