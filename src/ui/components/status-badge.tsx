const statusLabels: Record<string, string> = {
  DRAFT: "草稿",
  INPUT_READY: "待計算",
  CALCULATED: "已計算",
  REPORT_DRAFT: "報告草稿",
  DRAFT_EXPORTED: "草稿已匯出",
  IN_REVIEW: "舊狀態：可匯出草稿",
  REVIEWED: "舊狀態：可匯出草稿",
  ISSUED: "舊系統歷史（唯讀）",
  SUPERSEDED: "已被新版取代",
  COMPLETE: "計算完成",
  COMPLETE_WITH_REMINDER: "單軌完成，可匯出草稿",
  BLOCKED: "待補資料",
  CALCULATED_TRACK: "已完成",
  INSUFFICIENT_DATA: "資料不足",
  INVALID: "輸入不成立",
  ERROR: "未完成",
  ACTIVE: "使用中",
  HISTORICAL: "參考來源",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const value = status ?? "DRAFT";
  const tone = [
    "COMPLETE",
    "CALCULATED",
    "IN_REVIEW",
    "REVIEWED",
    "REPORT_DRAFT",
    "DRAFT_EXPORTED",
    "ACTIVE",
  ].includes(value)
    ? "success"
    : ["BLOCKED", "INVALID", "ERROR"].includes(value)
      ? "danger"
      : ["COMPLETE_WITH_REMINDER", "INSUFFICIENT_DATA", "HISTORICAL"].includes(
            value,
          )
        ? "warning"
        : "";
  return (
    <span className={`status-badge ${tone}`}>
      {statusLabels[value] ?? value}
    </span>
  );
}
