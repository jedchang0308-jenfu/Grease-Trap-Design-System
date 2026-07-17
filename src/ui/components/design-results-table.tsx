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
  設計處理水量: {
    description:
      "本次設計結果採用的排水處理流量，用來判斷油脂截留器需要處理多少水量。不同計算依據的原始單位可能不同，表格統一換算為 L/min 方便比對。",
    note: "內政部給排水規範（附錄 5）通常直接產出 L/min；臺北市工務局衛工處設計說明原始結果為 L/h，系統會除以 60 後比對。",
  },
  清除週期油脂量: {
    description:
      "依餐飲類型、人數或面積、油脂清除週期等條件估算在清除週期內會累積的油脂量，作為油脂容量需求判斷。",
    note: "此項目由內政部給排水規範（附錄 5）產出；臺北市工務局衛工處設計說明以有效容積為主，不產出此項目。",
  },
  設備所需有效容積: {
    description:
      "依臺北市工務局衛工處設計說明，使用用餐人數、每人每餐用水量 q、操作時間 t 與安全係數 k 等條件，計算設備需要提供的有效容積。",
    note: "此項目由臺北市工務局衛工處設計說明產出；內政部給排水規範（附錄 5）不產出此項目。",
  },
};

function ResultCell({ cell }: { cell: ReportOutputCell }) {
  if (cell.state === "NOT_COMPLETED") {
    return <span className="design-result-state incomplete">未完成</span>;
  }
  if (cell.state === "NOT_APPLICABLE") {
    return (
      <span className="design-result-state not-applicable">此依據無法計算</span>
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
            <th className="design-results-help-head" scope="col">
              說明
            </th>
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
              <th scope="row">{row.label}</th>
              <td className="design-results-help-cell">
                {outputItemHelp[row.label] ? (
                  <FieldHelpButton
                    ariaLabel={`${row.label}說明`}
                    help={outputItemHelp[row.label]}
                    showText={false}
                    title={row.label}
                  />
                ) : null}
              </td>
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
