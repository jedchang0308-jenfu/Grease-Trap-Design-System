import {
  buildDesignResults,
  type ReportOutputCell,
  type ReportOutputRun,
} from "@/domain/report/presentation";
import { basisForTrack } from "@/domain/rules/source-display";
import {
  FieldHelpButton,
  type FieldHelpContent,
} from "@/ui/components/field-help";

const outputItemHelp: Record<string, FieldHelpContent> = {
  "計算流量 Q": {
    description:
      "兩種算法都估算油脂截留器需要處理的廚房污水流量，統一稱為計算流量 Q，表格以 L/min 呈現。各算法仍依各自的計算期間、係數與適用條件估算。",
    note: "給排水設計技術規範（附錄第 5 點）通常直接產出 L/min；臺北市衛工處設計說明原始結果為 L/h，系統會除以 60 後比對。",
  },
  "截留油脂及沉積殘留物量 G": {
    description:
      "算法 B 計算的需求量 G，包含截留油脂量 Gu 與沉積殘留物量 Gb；兩部分分別採用預定油脂及沉積殘留物清除週期。",
    note: "此項目由給排水設計技術規範（附錄第 5 點）產出；臺北市衛工處設計說明以有效容積為主，不產出此項目。",
  },
  "所需除油室有效容積 V": {
    description:
      "依臺北市衛工處設計說明，以計算流量 Q 換算所需除油室有效容積 V；計算採用同期間用餐人數、每人每餐產生污水量 q、污水持續流出時間 t 與安全係數 k。",
    note: "此項目由臺北市衛工處設計說明產出；給排水設計技術規範（附錄第 5 點）不產出此項目。",
  },
};

function ResultCell({ cell }: { cell: ReportOutputCell }) {
  if (cell.state === "NOT_COMPLETED") {
    return <span className="design-result-state incomplete">未完成</span>;
  }
  if (cell.state === "NOT_APPLICABLE") {
    return (
      <span className="design-result-state not-applicable">
        此算法未直接計算
      </span>
    );
  }
  return (
    <>
      <strong className="design-result-value">{cell.value}</strong>
      {cell.unit ? (
        <span className="design-result-unit">{cell.unit}</span>
      ) : null}
    </>
  );
}

export function DesignResultsTable({
  mode,
  runs,
}: {
  mode: string;
  runs: ReportOutputRun[];
}) {
  const { tracks, rows } = buildDesignResults(runs, mode);

  if (!rows.length) {
    return (
      <p className="design-results-empty">
        本次尚無可列出的設計結果；系統不以 0 或推測值補齊。
      </p>
    );
  }

  return (
    <div className="design-results-table-wrap">
      <table className="design-results-table" aria-label="本次設計結果">
        <thead>
          <tr>
            <th scope="col">輸出項目</th>
            {tracks.map((track) => (
              <th scope="col" key={track}>
                {basisForTrack(track).shortLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">
                <span>{row.label}</span>
                {outputItemHelp[row.label] ? (
                  <FieldHelpButton
                    ariaLabel={`${row.label}說明`}
                    help={outputItemHelp[row.label]}
                    showText={false}
                    title={row.label}
                  />
                ) : null}
              </th>
              {tracks.map((track) => (
                <td data-label={basisForTrack(track).shortLabel} key={track}>
                  <ResultCell cell={row.cells[track]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
