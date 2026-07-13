import { scriptPool } from "./helpers";

const pool = scriptPool();
const requiredTables = [
  "users",
  "source_documents",
  "source_discrepancies",
  "rule_sets",
  "factor_tables",
  "factor_points",
  "calculation_cases",
  "calculation_runs",
  "report_snapshots",
  "audit_events",
];

const tableResult = await pool.query<{ table_name: string }>(
  `SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
  [requiredTables],
);
const found = new Set(tableResult.rows.map((row) => row.table_name));
const missing = requiredTables.filter((table) => !found.has(table));
if (missing.length) throw new Error(`Missing tables: ${missing.join(", ")}`);

const rules = await pool.query<{ method_family: string; checksum: string }>(
  "SELECT method_family, checksum FROM rule_sets WHERE status = 'ACTIVE' ORDER BY method_family",
);
if (rules.rowCount !== 2)
  throw new Error(`Expected 2 active rule sets, found ${rules.rowCount}`);

const counts = await pool.query<{ table_code: string; count: string }>(
  `SELECT ft.table_code, count(fp.id)::text AS count
     FROM factor_tables ft
     LEFT JOIN factor_points fp ON fp.table_id = ft.id
    GROUP BY ft.table_code ORDER BY ft.table_code`,
);
console.log("Database verification passed.");
console.table(counts.rows);
await pool.end();
