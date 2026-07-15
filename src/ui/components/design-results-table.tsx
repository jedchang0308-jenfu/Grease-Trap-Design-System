import {
  buildDesignResults,
  type ReportOutputCell,
  type ReportOutputRun,
} from "@/domain/report/presentation";
import { basisForTrack } from "@/domain/rules/source-display";

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
              {tracks.map((track) => (
                <td key={track}>
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
