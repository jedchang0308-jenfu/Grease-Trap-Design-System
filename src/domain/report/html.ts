import Decimal from "decimal.js";
import {
  basisForTrack,
  calculationTrackOrder,
  modeDisplayFor,
} from "../rules/source-display";
import {
  buildInputGroups,
  buildDesignResults,
  formulaValues,
  reportTracksForMode,
  type ReportInputGroup,
  type ReportOutputCell,
} from "./presentation";
import {
  REPORT_NUMBER_PLACEHOLDER,
  type ReportDocumentKind,
  type ReportSnapshotData,
  type SnapshotRun,
} from "./types";

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

function jenfuLogoDataUri(): string {
  return "/jenfu-logo-small.png";
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
  T06_EFFECTIVE_VOLUME_TO_FLOW: "由設備有效容積換算設計處理水量",
};

const primaryOutputLabelsByTask: Record<string, readonly string[]> = {
  T01_DINERS_TO_FLOW: ["設計處理水量"],
  T02_DINERS_TO_DESIGN: ["設計處理水量", "清除週期油脂量", "設備所需有效容積"],
  T03_AREA_TO_FLOW: ["設計處理水量"],
  T04_AREA_TO_DESIGN: ["設計處理水量", "清除週期油脂量", "設備所需有效容積"],
  T05_DESIGN_TO_DINERS_AND_AREA: ["可支援的用餐人數", "可支援的服務面積"],
  T06_EFFECTIVE_VOLUME_TO_FLOW: ["設計處理水量"],
};

const referenceOnlyInputLabelsByTask: Record<string, readonly string[]> = {
  T01_DINERS_TO_FLOW: ["油脂清除週期", "殘渣清除週期"],
  T03_AREA_TO_FLOW: ["油脂清除週期", "殘渣清除週期"],
};

const primaryOutcomeFormulaCodesByTask: Record<string, readonly string[]> = {
  T01_DINERS_TO_FLOW: ["CUR-DIN-Q", "LEG-MEAN-Q", "LEG-DIN-Q"],
  T02_DINERS_TO_DESIGN: [
    "CUR-DIN-Q",
    "CUR-DIN-G",
    "LEG-MEAN-Q",
    "LEG-DIN-Q",
    "LEG-VEFF",
  ],
  T03_AREA_TO_FLOW: ["CUR-AREA-Q", "LEG-DIN-Q"],
  T04_AREA_TO_DESIGN: ["CUR-AREA-Q", "CUR-AREA-G", "LEG-DIN-Q", "LEG-VEFF"],
  T05_DESIGN_TO_DINERS_AND_AREA: [
    "CUR-REV-N-Q",
    "CUR-REV-N-G",
    "CUR-REV-A",
    "LEG-REV-N",
    "LEG-REV-A",
  ],
  T06_EFFECTIVE_VOLUME_TO_FLOW: ["LEG-VOL-QM"],
};

function isPrimaryCalculationStep(
  taskCode: string,
  formulaCode: string,
): boolean {
  if (
    taskCode === "T02_DINERS_TO_DESIGN" ||
    taskCode === "T04_AREA_TO_DESIGN" ||
    taskCode === "T05_DESIGN_TO_DINERS_AND_AREA"
  )
    return true;
  if (taskCode === "T01_DINERS_TO_FLOW")
    return (
      formulaCode === "CUR-DIN-Q" ||
      formulaCode === "LEG-DIN-Q" ||
      formulaCode === "LEG-MEAN-Q" ||
      formulaCode.startsWith("LEG-PERIOD-")
    );
  if (taskCode === "T03_AREA_TO_FLOW")
    return ["CUR-AREA-A", "CUR-AREA-Q", "LEG-AREA-N", "LEG-DIN-Q"].includes(
      formulaCode,
    );
  if (taskCode === "T06_EFFECTIVE_VOLUME_TO_FLOW")
    return ["LEG-VOL-QH", "LEG-VOL-QM"].includes(formulaCode);
  return true;
}

function isPrimaryOutcomeStep(
  taskCode: string,
  step: SnapshotRun["steps"][number],
  run: SnapshotRun,
): boolean {
  if (
    taskCode === "T05_DESIGN_TO_DINERS_AND_AREA" &&
    ["CUR-REV-N-Q", "CUR-REV-N-G"].includes(step.formulaCode)
  ) {
    const candidates = run.steps.filter((candidate) =>
      ["CUR-REV-N-Q", "CUR-REV-N-G"].includes(candidate.formulaCode),
    );
    try {
      const limitingValue = candidates
        .map((candidate) => new Decimal(candidate.result))
        .reduce((minimum, value) => Decimal.min(minimum, value));
      return new Decimal(step.result).equals(limitingValue);
    } catch {
      return false;
    }
  }
  return (primaryOutcomeFormulaCodesByTask[taskCode] ?? []).includes(
    step.formulaCode,
  );
}

function formatNumber(value: string, maximumFractionDigits = 4): string {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString("zh-TW", { maximumFractionDigits })
    : value;
}

const formulaSubscriptTokens: Record<
  string,
  { base: string; subscript: string; suffix?: string }
> = {
  Qhour: { base: "Q", subscript: "hour" },
  Qminute: { base: "Q", subscript: "minute" },
  Veff: { base: "V", subscript: "eff" },
  Qmeasured: { base: "Q", subscript: "measured" },
  Qcapacity: { base: "Q", subscript: "capacity" },
  Gcapacity: { base: "G", subscript: "capacity" },
  Wm: { base: "W", subscript: "m" },
  "Wm'": { base: "W", subscript: "m", suffix: "′" },
  Gu: { base: "G", subscript: "u" },
  Gb: { base: "G", subscript: "b" },
  gu: { base: "g", subscript: "u" },
  gb: { base: "g", subscript: "b" },
  iu: { base: "i", subscript: "u" },
  ib: { base: "i", subscript: "b" },
  n0: { base: "n", subscript: "0" },
  baseQi: { base: "baseQ", subscript: "i" },
  ni: { base: "n", subscript: "i" },
  qi: { base: "q", subscript: "i" },
  ti: { base: "t", subscript: "i" },
  N_by_Q: { base: "N", subscript: "by Q" },
  N_by_G: { base: "N", subscript: "by G" },
  nEquivalentMax: { base: "n", subscript: "EquivalentMax" },
};

function formulaMarkup(value: string): string {
  return value
    .split(/([A-Za-z][A-Za-z0-9_']*)/)
    .map((token) => {
      const formatted = formulaSubscriptTokens[token];
      if (!formatted) return escapeHtml(token);
      return `${escapeHtml(formatted.base)}<sub>${escapeHtml(formatted.subscript)}</sub>${formatted.suffix ? escapeHtml(formatted.suffix) : ""}`;
    })
    .join("");
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
    "LEG-VOL-QH": "由有效容積換算每小時處理水量",
    "LEG-VOL-QM": "換算每分鐘設計處理水量",
  };
  return labels[formulaCode] ?? "依本計算依據公式計算";
}

function formatStepResult(value: string, unit: string): string {
  const displayUnit = unit === "person" ? "人" : unit;
  const maximumFractionDigits = unit === "L/min" ? 1 : 4;
  return `${escapeHtml(formatNumber(value, maximumFractionDigits))}${displayUnit ? ` ${escapeHtml(displayUnit)}` : ""}`;
}

const finalFlowFormulaCodes = new Set([
  "CUR-DIN-Q",
  "CUR-AREA-Q",
  "LEG-MEAN-Q",
  "LEG-DIN-Q",
  "LEG-MEASURED-Q",
]);

function stepComparisonValue(step: SnapshotRun["steps"][number]): string {
  if (step.unit !== "L/h" || !finalFlowFormulaCodes.has(step.formulaCode))
    return "";
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
        `<tr><td>${escapeHtml(row.label)}</td><td class="number-cell">${escapeHtml(row.value)}${row.unit ? ` <span class="unit">${escapeHtml(row.unit)}</span>` : ""}</td><td>${roleBadge(row.role)}</td><td>${row.sourceNote ? escapeHtml(row.sourceNote) : ""}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

function inputOverview(
  groups: ReportInputGroup[],
  chapterNumber: string,
): string {
  if (!groups.length) {
    return `<div class="empty-note">本次快照沒有可列出的輸入條件；報告不以 0 或推測值補齊。</div>`;
  }
  return `<div class="input-groups">${groups
    .map((group, index) => {
      const methodNumber = `${chapterNumber}.${index + 1}`;
      return `<section class="input-group"><h3>${methodNumber} ${escapeHtml(group.sourceLabel)}</h3>${inputRows(group)}</section>`;
    })
    .join("")}</div>`;
}

function outputCell(cell: ReportOutputCell): string {
  if (cell.state === "NOT_COMPLETED")
    return `<span class="cell-state not-completed">未完成</span>`;
  if (cell.state === "NOT_APPLICABLE")
    return `<span class="cell-state not-applicable">此依據無法計算</span>`;
  return `<strong class="output-value">${escapeHtml(cell.value)}</strong>${cell.unit ? ` <span class="unit">${escapeHtml(cell.unit)}</span>` : ""}`;
}

function outputOverview(
  snapshot: ReportSnapshotData,
  includeReferenceCalculations: boolean,
): string {
  const { tracks, rows } = buildDesignResults(
    snapshot.runs,
    snapshot.case.mode,
  );
  const primaryOutputLabels =
    primaryOutputLabelsByTask[snapshot.case.taskCode] ?? [];
  const visibleRows = includeReferenceCalculations
    ? rows
    : rows.filter((row) => primaryOutputLabels.includes(row.label));
  if (!visibleRows.length)
    return `<div class="empty-note">本次尚無可列出的設計結果；報告不以 0 或推測值補齊。</div>`;
  return `<div class="table-scroll"><table class="output-table"><thead><tr><th>輸出項目</th>${tracks
    .map((track) => `<th>${escapeHtml(basisForTrack(track).shortLabel)}</th>`)
    .join("")}</tr></thead><tbody>${visibleRows
    .map(
      (row) =>
        `<tr><th>${escapeHtml(row.label)}</th>${tracks
          .map((track) => {
            const cell = row.cells[track];
            const emphasisClass =
              cell.state === "VALUE" && primaryOutputLabels.includes(row.label)
                ? ' class="output-cell-final"'
                : "";
            return `<td${emphasisClass}>${outputCell(cell)}</td>`;
          })
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
        `<tr><td class="symbol">${formulaMarkup(value.symbol)}</td><td>${escapeHtml(value.label)}</td><td class="number-cell">${escapeHtml(value.value)}</td><td>${escapeHtml(value.unit || "—")}</td><td>${roleBadge(value.role)}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

function algorithmProcess(
  run: SnapshotRun,
  inputGroup: ReportInputGroup | undefined,
  chapterNumber: string,
  taskCode: string,
  includeReferenceCalculations: boolean,
): string {
  const basis = basisForTrack(run.track);
  if (!run.steps.length)
    return `<section class="algorithm-method"><h3>${chapterNumber} 使用${escapeHtml(basis.shortLabel)}</h3><p class="muted">目前沒有可列出的計算步驟。</p></section>`;
  const renderStep = (step: SnapshotRun["steps"][number], index: number) => {
    const comparison = stepComparisonValue(step);
    const primary = isPrimaryCalculationStep(taskCode, step.formulaCode);
    const primaryOutcome = isPrimaryOutcomeStep(taskCode, step, run);
    const relevanceClass = primary ? "is-primary" : "is-reference";
    const resultClass =
      primaryOutcome && !comparison ? " step-primary-result" : "";
    const comparisonClass = primaryOutcome ? " step-primary-result" : "";
    return `<li class="algorithm-step ${relevanceClass}"><p class="step-purpose"><span class="step-index">步驟 ${index + 1}</span>${escapeHtml(formulaPurpose(step.formulaCode))}</p><div class="step-content"><p class="step-line"><span class="step-label">公式</span><span class="step-expression">${formulaMarkup(step.expression)}</span></p><div class="formula-block"><p class="step-label">代入內容</p>${formulaValueTable(step, inputGroup)}</div><p class="step-line"><span class="step-label">數值算式</span><span class="step-expression">${escapeHtml(step.substitution)}</span></p><p class="step-line step-result${resultClass}"><span class="step-label">計算結果</span><strong>${formatStepResult(step.result, step.unit)}</strong></p>${comparison ? `<p class="step-line step-comparison${comparisonClass}"><span class="step-label">每分鐘流量</span><strong>${comparison}</strong></p>` : ""}</div></li>`;
  };
  const visibleSteps = run.steps
    .map((step, index) => ({ step, index }))
    .filter(
      ({ step }) =>
        includeReferenceCalculations ||
        isPrimaryCalculationStep(taskCode, step.formulaCode),
    );
  if (!visibleSteps.length) return "";
  let referenceDividerInserted = false;
  const stepsMarkup = visibleSteps
    .map(({ step, index }) => {
      const isReference = !isPrimaryCalculationStep(taskCode, step.formulaCode);
      const divider =
        includeReferenceCalculations && isReference && !referenceDividerInserted
          ? `<li class="reference-divider"><span>以下為參考計算</span></li>`
          : "";
      if (divider) referenceDividerInserted = true;
      return `${divider}${renderStep(step, index)}`;
    })
    .join("");
  return `<section class="algorithm-method"><h3>${chapterNumber} 使用${escapeHtml(basis.shortLabel)}</h3><ol class="algorithm-steps">${stepsMarkup}</ol></section>`;
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

export function renderReportHtml(
  snapshot: ReportSnapshotData,
  documentKind: ReportDocumentKind = "DRAFT",
  options: {
    includeReferenceCalculations?: boolean;
    provenance?: "REGENERATED_HISTORY";
  } = {},
): string {
  const isFormal = documentKind === "FORMAL";
  const includeReferenceCalculations =
    options.includeReferenceCalculations ?? false;
  const regeneratedHistory = options.provenance === "REGENERATED_HISTORY";
  const orderedRuns = [
    ...calculationTrackOrder.flatMap((track) =>
      snapshot.runs.filter((run) => run.track === track),
    ),
    ...snapshot.runs.filter(
      (run) => !calculationTrackOrder.some((track) => track === run.track),
    ),
  ];
  const hasReferenceCalculations = orderedRuns.some((run) =>
    run.steps.some(
      (step) =>
        !isPrimaryCalculationStep(snapshot.case.taskCode, step.formulaCode),
    ),
  );
  const calculationSectionTitle =
    hasReferenceCalculations && !includeReferenceCalculations
      ? "本次計算任務過程"
      : "完整計算過程";
  const calculationGuide = includeReferenceCalculations
    ? "採用值依規則取整；以下列出完整計算步驟。"
    : "採用值依規則取整；以下僅列本次計算任務的計算步驟。";
  const reportNumber = isFormal
    ? snapshot.reportNumber
    : REPORT_NUMBER_PLACEHOLDER;
  const task = taskLabels[snapshot.case.taskCode] ?? "設計需求計算";
  const reportTitleBase = isFormal
    ? "油脂截留器設計計算報告"
    : "油脂截留器設計計算報告草稿";
  const reportTitle = regeneratedHistory
    ? `${reportTitleBase}（歷史版本重新產生）`
    : reportTitleBase;
  const versionLabel = `版本 ${snapshot.case.revisionNo}`;
  const coverDocumentMeta = isFormal
    ? `<p>報告編號：${escapeHtml(reportNumber)}</p><p>版次：${escapeHtml(versionLabel)}</p>`
    : `<p>文件狀態：草稿</p>`;
  const provenanceMarkup = regeneratedHistory
    ? `<div class="banner warning historical-provenance"><strong>歷史版本重新產生</strong><br>本文件使用保存的歷史資料套用目前版型重新產生，不是當時的原始 PDF。</div>`
    : "";
  const reportNumberHeader = isFormal
    ? `"報告編號：" ${cssString(reportNumber)}`
    : '"報告草稿"';
  const reportVersionHeader = isFormal
    ? `"版次：" ${cssString(versionLabel)}`
    : '""';
  const screenFooterStatus = regeneratedHistory
    ? '<span class="screen-footer-page">歷史版本重新產生</span>'
    : isFormal
      ? '<span class="screen-footer-page">正式報告</span>'
      : "";
  const footerLogo = jenfuLogoDataUri();
  const footerLogoRule = footerLogo
    ? `background-image: url("${footerLogo}"); background-repeat: no-repeat; background-position: right 28mm center; background-size: 3.2mm auto;`
    : "";
  const inputGroups = buildInputGroups(
    snapshot.inputs,
    orderedRuns.map((run) => run.track),
  );
  const hiddenInputLabels = new Set(
    referenceOnlyInputLabelsByTask[snapshot.case.taskCode] ?? [],
  );
  const visibleInputGroups = includeReferenceCalculations
    ? inputGroups
    : inputGroups.map((group) => ({
        ...group,
        rows: group.rows.filter((row) => !hiddenInputLabels.has(row.label)),
      }));
  const mode = modeDisplayFor(snapshot.case.mode);
  const summaryItems = [
    { label: "案件", value: `${snapshot.case.caseNo} / ${versionLabel}` },
    { label: "客戶", value: snapshot.case.customer },
    { label: "設置地點", value: snapshot.case.location },
    { label: "本次計算任務", value: task },
    { label: "計算依據", value: mode.label },
  ];
  const summaryMarkup = summaryItems
    .reduce<string[]>((rows, item, index) => {
      if (index % 2 !== 0) return rows;
      const next = summaryItems[index + 1];
      rows.push(
        next
          ? `<tr><th scope="row">${escapeHtml(item.label)}</th><td>${escapeHtml(item.value)}</td><th scope="row">${escapeHtml(next.label)}</th><td>${escapeHtml(next.value)}</td></tr>`
          : `<tr><th scope="row">${escapeHtml(item.label)}</th><td colspan="3">${escapeHtml(item.value)}</td></tr>`,
      );
      return rows;
    }, [])
    .join("");
  const groupForTrack = (track: string) =>
    visibleInputGroups.find((group) => group.track === track);
  const detailsClass = "page-break";
  const methodChapterNumbers = new Map<string, string>(
    inputGroups.map((group, index) => [group.track, `4.${index + 1}`]),
  );

  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><title>${escapeHtml(reportNumber)} - ${escapeHtml(reportTitle)}</title><link rel="stylesheet" href="/report-fonts/report-font.css" data-report-font>
<style>
@page cover { size: A4; margin: 12.7mm; @top-center { content: none; } @bottom-center { content: none; } @bottom-right { content: none; } }
@page report { size: A4; margin: 12.7mm 12.7mm 18mm; @top-left { content: ${cssString(reportTitle)}; font-family: "Jenfu Report Sans", sans-serif; font-size: 9pt; color: #777; text-align: left; vertical-align: bottom; border-bottom: 1.5pt solid #4472C4; padding-bottom: 1mm; } @top-center { content: ${reportNumberHeader}; font-family: "Jenfu Report Sans", sans-serif; font-size: 9pt; color: #777; text-align: center; vertical-align: bottom; border-bottom: 1.5pt solid #4472C4; padding-bottom: 1mm; } @top-right { content: ${reportVersionHeader}; font-family: "Jenfu Report Sans", sans-serif; font-size: 9pt; color: #777; text-align: left; vertical-align: bottom; border-bottom: 1.5pt solid #4472C4; padding-bottom: 1mm; } @bottom-left-corner { content: ""; width: 7mm; height: 7mm; border-top: .7pt solid #9A9A9A; border-left: .7pt solid #9A9A9A; } @bottom-center { content: "頁次 " counter(page) "/" counter(pages); font-family: "Jenfu Report Sans", sans-serif; font-size: 9pt; color: #777; } @bottom-right { content: "鉦富機械有限公司"; ${footerLogoRule} font-family: "Jenfu Report Sans", sans-serif; font-size: 10pt; font-weight: 700; color: #777; text-align: right; white-space: nowrap; } @bottom-right-corner { content: ""; width: 7mm; height: 7mm; border-top: .7pt solid #9A9A9A; border-right: .7pt solid #9A9A9A; } }
* { box-sizing: border-box; }
html { color-scheme: light; font-synthesis: none; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
body { margin: 0; color: #111; background: #fff; font-family: "Jenfu Report Sans", sans-serif; font-size: 12pt; font-variant-numeric: tabular-nums; line-height: 1.45; text-rendering: geometricPrecision; }
p { margin: 0 0 3mm; orphans: 3; widows: 3; }
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
 h2 { margin: 6mm 0 3mm; padding: 0; color: #111; font-size: 14pt; line-height: 1.3; }
h3 { margin: 3mm 0 2mm; color: #111; font-size: 12pt; line-height: 1.35; }
h4 { margin: 3mm 0 2mm; color: #111; font-size: 10.5pt; line-height: 1.35; }
h1, h2, h3, h4 { break-after: avoid-page; page-break-after: avoid; }
.eyebrow { margin-bottom: 2mm; color: #4472C4; font-size: 9pt; font-weight: 700; letter-spacing: 0; }
.document-number { color: #333; font-size: 9pt; font-variant-numeric: tabular-nums; margin-bottom: 3mm; }
.summary-table { margin: 3mm 0 5mm; font-size: 8.5pt; }
.summary-table tbody th { width: 14%; background: #F2F2F2; color: #555; font-weight: 700; }
.summary-table tbody td { width: 36%; }
.summary-table td { font-weight: 400; }
.flow-strip { display: grid; grid-template-columns: 1fr 1fr 1fr; margin: 4mm 0 5mm; border: 1px solid #7f7f7f; background: #fff; break-inside: avoid; }
.flow-step { position: relative; min-height: 16mm; padding: 3mm 4mm; }
.flow-step + .flow-step { border-left: 1px solid #7f7f7f; }
.flow-step + .flow-step::before { content: "→"; position: absolute; left: -3.2mm; top: 5.2mm; width: 6mm; background: #fff; color: #4472C4; text-align: center; font-weight: 700; }
.flow-step span { display: block; color: #555; font-size: 8pt; }
.flow-step strong { display: block; margin-top: .5mm; color: #111; font-size: 10pt; }
.banner { margin: 4mm 0; padding: 3mm 4mm; border: 1px solid #4472C4; border-left-width: 4px; background: #F8FAFF; break-inside: avoid; }
.banner.warning { border-color: #BD7621; background: #FFF8ED; }
.condition-badges { display: flex; flex-wrap: wrap; gap: 2mm; margin: 0 0 3mm; }
.condition-badge { display: inline-flex; flex-direction: column; gap: .4mm; border: 1px solid #9fb3d8; border-radius: 2mm; padding: 1.2mm 2.2mm; background: #F8FAFF; color: #1f1f1f; font-size: 8pt; font-weight: 400; }
.condition-badge small { color: #555; font-size: 7pt; font-weight: 400; }
.condition-badge.warning { border-color: #D6A45D; background: #FFF8ED; color: #623B08; }
.condition-badge.info { border-color: #9FB3D8; background: #F8FAFF; color: #26496F; }
.input-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3mm; }
.input-group { padding: 0; break-inside: avoid; }
.input-groups > .input-group:only-child { grid-column: 1 / -1; }
.group-source { margin: 0 0 1mm; color: #555; font-size: 8pt; font-weight: 400; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: 1px solid #7f7f7f; padding: 1.6mm 2mm; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
tr, th, td { break-inside: avoid; page-break-inside: avoid; }
img { break-inside: avoid; page-break-inside: avoid; }
thead th { background: #F2F2F2; color: #111; font-size: 8pt; font-weight: 700; text-align: center; }
 .input-table { font-size: 8.2pt; }
 .input-table th:nth-child(3), .input-table td:nth-child(3), .formula-values th:last-child, .formula-values td:last-child { display: none; }
.input-table th:nth-child(1) { width: 34%; }
.input-table th:nth-child(2) { width: 28%; }
.input-table th:nth-child(3) { width: 18%; }
.number-cell { white-space: nowrap; }
/* 報告輸入表的選值理由可能是完整句子，不能因數值欄的預設不換行而穿越相鄰欄位。 */
.input-table .number-cell { white-space: normal; overflow-wrap: anywhere; }
.unit { color: #444; font-size: .9em; white-space: nowrap; }
.role-badge { display: inline-block; border: 1px solid #9FB3D8; border-radius: 2mm; padding: .3mm 1.3mm; background: #F8FAFF; color: #1f1f1f; font-size: 7pt; font-weight: 400; white-space: nowrap; }
.role-case { border-color: #9FB3D8; }
.role-source { border-color: #D6A45D; background: #FFF8ED; }
.role-derived { border-color: #9FB3D8; }
.result-section { break-inside: avoid; }
.table-scroll { border: 0; break-inside: avoid; }
.output-table th, .output-table td { padding: 1.8mm 2.5mm; }
.output-table thead th { font-size: 8.5pt; }
.output-table tbody th { width: 34%; background: #F2F2F2; color: #111; }
.output-value { color: #111; font-size: 11pt; }
.output-table td.output-cell-final { background: #F3F7FF; box-shadow: inset 3px 0 0 #4472C4; }
.output-table td.output-cell-final .output-value { display: inline-block; color: #173B63; font-size: 13pt; font-weight: 800; line-height: 1.15; }
.output-table td.output-cell-final .unit { color: #173B63; font-size: .95em; font-weight: 700; }
.cell-state { font-size: 8pt; font-weight: 400; }
.not-completed { color: #8a4b08; }
.not-applicable { color: #555; }
.empty-note { margin: 2mm 0; padding: 2mm 3mm; border: 1px solid #BFBFBF; border-left: 4px solid #A6A6A6; background: #F7F7F7; color: #555; }
.empty-note.compact { font-size: 8pt; }
.page-break { break-before: page; }
 .comparison-guide { margin: 0 0 4mm; padding: 0 0 0 3mm; border-left: 2px solid #4472C4; color: #333; font-size: 8.5pt; }
.comparison-guide strong, .comparison-guide span { display: block; }
.comparison-guide strong { margin-bottom: .6mm; color: #173B63; font-size: 9pt; }
.muted { color: #555; font-size: 8.5pt; }
.method-badge { display: inline-block; padding: 1mm 2.5mm; border: 1px solid #9FB3D8; border-radius: 2mm; background: #F8FAFF; color: #111; font-size: 8pt; font-weight: 700; break-after: avoid-page; page-break-after: avoid; }
.algorithm-method { margin: 4mm 0 6mm; }
 .algorithm-method + .algorithm-method { padding-top: 5mm; border-top: 0; }
.method-inputs { margin-bottom: 4mm; }
.algorithm-steps { list-style: none; margin: 3mm 0 0; padding: 0; }
.algorithm-step { padding: 2mm 0; break-inside: avoid; }
.reference-divider { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 3mm; margin: 5mm 0 1mm; padding: 0; color: #173B63; font-size: 9pt; font-weight: 700; list-style: none; text-align: center; }
.reference-divider::before, .reference-divider::after { content: ""; border-top: 1px solid #9FB3D8; }
.step-content { min-width: 0; }
.step-purpose { margin: 0 0 1mm; color: #111; font-weight: 700; }
.step-index { display: inline-block; min-width: 16mm; margin-right: 2mm; color: #4472C4; }
.step-line { display: grid; grid-template-columns: 19mm 1fr; gap: 2mm; margin: 0 0 .6mm; font-size: 8.5pt; }
.step-label { color: #555; font-weight: 400; }
.step-expression { color: #111; overflow-wrap: anywhere; }
.step-expression sub, .formula-values .symbol sub { font-size: .72em; line-height: 0; vertical-align: -0.25em; }
.formula-block { margin: 1mm 0; }
.formula-block > .step-label { display: block; margin-bottom: .6mm; font-size: 8.5pt; }
.formula-values { font-size: 7.7pt; }
.formula-values th, .formula-values td { padding: 1mm 1.5mm; }
.formula-values .symbol { color: #111; font-variant-numeric: tabular-nums; font-weight: 400; }
.step-result { color: #111; font-weight: 700; margin-top: .6mm; }
.step-comparison { margin-top: .6mm; padding: .8mm 1.5mm; border: 1px solid #9FB3D8; background: #F8FAFF; color: #111; }
.step-primary-result { padding: .8mm 1.5mm; border-left: 3px solid #4472C4; background: #F3F7FF; color: #173B63; }
.step-primary-result .step-label { color: #173B63; }
@media screen { body { background: #E9EDF3; padding: 8mm 0; } .cover-page, .report-body { width: 210mm; margin: 0 auto 8mm; background: #fff; box-shadow: 0 0 0 1px #d9dfe8; } .cover-page { padding: 12.7mm; } .report-body { padding: 8mm 12.7mm 14mm; } .screen-report-header { display: grid; grid-template-columns: 1fr 1.3fr .7fr; column-gap: 6mm; align-items: end; margin: 0 0 7mm; padding-bottom: 1mm; border-bottom: 1.5pt solid #4472C4; color: #777; font-size: 9pt; } .screen-report-header span:nth-child(2) { text-align: center; } .screen-report-footer { display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: center; min-height: 10mm; margin-top: 12mm; color: #777; font-size: 9pt; } .screen-footer-page { text-align: center; } .screen-footer-brand { display: inline-flex; grid-column: 3; align-items: center; justify-content: flex-end; gap: 1.3mm; font-size: 10pt; font-weight: 700; } .screen-footer-logo { width: 3.2mm; height: auto; } }
@media screen and (max-width: 800px) { body { padding: 0; background: #fff; font-size: 10pt; } .cover-page, .report-body { width: 100%; margin: 0; box-shadow: none; } .cover-page { min-height: 100vh; padding: 20px; } .cover-brand { margin-top: 34px; } .cover-logo { width: 54px; margin-bottom: 14px; } .cover-company-cn { font-size: 20pt; } .cover-company-en { font-size: 11pt; } .cover-title { margin-top: 54px; font-size: 20pt; } .cover-meta { margin: 24px 0 12px; } .cover-meta-strip { height: 12px; } .cover-meta-body { padding: 16px; font-size: 11pt; line-height: 1.55; overflow-wrap: anywhere; } .report-body { padding: 16px; } .screen-report-header { grid-template-columns: 1fr; gap: 4px; margin-bottom: 20px; } .screen-report-header span:nth-child(2) { text-align: left; overflow-wrap: anywhere; } .input-groups { grid-template-columns: 1fr; } .flow-strip { grid-template-columns: 1fr; } .flow-step + .flow-step { border-top: 1px solid #7f7f7f; border-left: 0; } .flow-step + .flow-step::before { display: none; } .summary-table { font-size: 8pt; } .summary-table tbody th { width: 18%; } .summary-table tbody td { width: 32%; } .step-line { grid-template-columns: 1fr; } .screen-report-footer { grid-template-columns: 1fr; } .screen-footer-page { text-align: left; } .screen-footer-brand { grid-column: 1; justify-content: flex-start; } }
@media print { html, body { background: #fff; } .cover-page, .report-body { box-shadow: none; } .screen-report-header, .screen-report-footer { display: none; } }
</style></head><body>
 <section class="cover-page"><div class="cover-brand">${logoMarkup("jenfu-logo cover-logo")}<div class="cover-company-cn">鉦富機械有限公司</div></div><h1 class="cover-title">${escapeHtml(reportTitle)}</h1><div class="cover-spacer"></div><div class="cover-meta"><div class="cover-meta-strip"></div><div class="cover-meta-body">${coverDocumentMeta}${regeneratedHistory ? "<p>資料來源：歷史版本重新產生</p>" : ""}</div></div></section>
 <main class="report-body">${provenanceMarkup}<section class="overview"><h2>1 案件資料</h2><table class="summary-table"><tbody>${summaryMarkup}</tbody></table>${missingWorkflowBanner(snapshot)}<h2>2 本次輸入條件</h2>${inputOverview(visibleInputGroups, "2")}<div class="result-section"><h2>3 本次設計結果</h2>${outputOverview(snapshot, includeReferenceCalculations)}</div></section>
 <section class="${detailsClass}"><h2>4 ${calculationSectionTitle}</h2><p class="comparison-guide"><strong>本次計算任務｜${escapeHtml(task)}</strong><span>${calculationGuide}</span></p>${orderedRuns.map((run, index) => algorithmProcess(run, groupForTrack(run.track), methodChapterNumbers.get(run.track) ?? `4.${index + 1}`, snapshot.case.taskCode, includeReferenceCalculations)).join("")}</section><div class="screen-report-footer"><span></span>${screenFooterStatus}<span class="screen-footer-brand">${logoMarkup("screen-footer-logo")}鉦富機械有限公司</span></div></main>
</body></html>`;
}
