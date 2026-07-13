import { env } from "../../src/config/env";
import {
  a36Areas,
  currentAreaFactors,
  currentDinerFactors,
  currentN0Table,
  currentRuleChecksum,
  currentSeatUtilization,
  legacyRuleChecksum,
  legacySafetyFactors,
  legacyWaterFactors,
  sourceDiscrepancies,
  sourceDocuments,
} from "../../src/domain/rules/seed-data";
import { scriptPool } from "./helpers";

const pool = scriptPool();
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query(
    `INSERT INTO users(id, identity_subject, display_name, status)
     VALUES ($1, 'local-seed-engineer', $2, 'ACTIVE')
     ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, status = 'ACTIVE'`,
    [env.LOCAL_SEED_USER_ID, env.LOCAL_SEED_USER_NAME],
  );
  for (const role of ["ENGINEER", "RULE_ADMIN", "SYSTEM_ADMIN"]) {
    await client.query(
      "INSERT INTO user_roles(user_id, role) VALUES($1, $2) ON CONFLICT DO NOTHING",
      [env.LOCAL_SEED_USER_ID, role],
    );
  }

  for (const source of sourceDocuments) {
    await client.query(
      `INSERT INTO source_documents(code, title, authority_level, checked_at, uri, sha256, status)
       VALUES($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (code) DO NOTHING`,
      [
        source.code,
        source.title,
        source.authorityLevel,
        source.checkedAt,
        source.uri,
        source.sha256,
        source.status,
      ],
    );
  }

  for (const [
    code,
    sourceCode,
    description,
    resolution,
  ] of sourceDiscrepancies) {
    await client.query(
      `INSERT INTO source_discrepancies(code, source_document_id, description, resolution, approved_by)
       SELECT $1, id, $3, $4, $5 FROM source_documents WHERE code = $2
       ON CONFLICT (code) DO NOTHING`,
      [code, sourceCode, description, resolution, env.LOCAL_SEED_USER_ID],
    );
  }

  const ruleSpecs = [
    [
      "RULE-CURRENT-QG",
      "2020.1",
      "CURRENT_QG",
      currentRuleChecksum,
      "SRC-CURRENT-2020",
    ],
    [
      "RULE-LEGACY-QV",
      "legacy.1",
      "LEGACY_QV",
      legacyRuleChecksum,
      "SRC-LEGACY-FULL",
    ],
  ] as const;

  for (const [code, version, family, checksum, sourceCode] of ruleSpecs) {
    await client.query(
      `INSERT INTO rule_sets(code, version, method_family, status, checksum, source_document_id, activated_at)
       SELECT $1, $2, $3, 'ACTIVE', $4, id, now() FROM source_documents WHERE code = $5
       ON CONFLICT (code, version) DO NOTHING`,
      [code, version, family, checksum, sourceCode],
    );
    const actual = await client.query<{ checksum: string }>(
      "SELECT checksum FROM rule_sets WHERE code = $1 AND version = $2",
      [code, version],
    );
    if (actual.rows[0]?.checksum !== checksum) {
      throw new Error(
        `Immutable rule ${code}@${version} checksum mismatch; create a new version.`,
      );
    }
  }

  const currentRule = await client.query<{ id: string }>(
    "SELECT id FROM rule_sets WHERE code='RULE-CURRENT-QG'",
  );
  const legacyRule = await client.query<{ id: string }>(
    "SELECT id FROM rule_sets WHERE code='RULE-LEGACY-QV'",
  );

  async function ensureTable(
    ruleSetId: string,
    code: string,
    dimensions: object,
    units: object,
  ) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO factor_tables(rule_set_id, table_code, dimension_schema, unit_schema)
       VALUES($1, $2, $3, $4)
       ON CONFLICT (rule_set_id, table_code) DO UPDATE SET table_code = EXCLUDED.table_code
       RETURNING id`,
      [ruleSetId, code, dimensions, units],
    );
    return result.rows[0].id;
  }

  async function point(
    tableId: string,
    diningType: string,
    key: string,
    value: string | null,
    state = "VALUE",
  ) {
    await client.query(
      `INSERT INTO factor_points(table_id, dining_type, dimension_key, value, source_state)
       VALUES($1, $2, $3, $4, $5) ON CONFLICT (table_id, dining_type, dimension_key) DO NOTHING`,
      [tableId, diningType, key, value, state],
    );
  }

  const a34 = await ensureTable(
    currentRule.rows[0].id,
    "A-34",
    { diningType: "enum", field: "enum" },
    { Wm: "L/(m2·day)", t: "min/day", gu: "g/(m2·day)", gb: "g/(m2·day)" },
  );
  for (const [type, factors] of Object.entries(currentAreaFactors)) {
    for (const [key, value] of Object.entries(factors))
      await point(a34, type, key, value);
  }

  const a35 = await ensureTable(
    currentRule.rows[0].id,
    "A-35",
    { diningType: "enum" },
    { n: "ratio" },
  );
  for (const [type, value] of Object.entries(currentSeatUtilization))
    await point(a35, type, "n", value);

  const a36 = await ensureTable(
    currentRule.rows[0].id,
    "A-36",
    { diningType: "enum", area: "m2" },
    { n0: "ratio" },
  );
  for (const [type, row] of Object.entries(currentN0Table)) {
    let hasSeenValue = false;
    for (let index = 0; index < a36Areas.length; index += 1) {
      const value = row[index];
      if (value !== null) hasSeenValue = true;
      await point(
        a36,
        type,
        String(a36Areas[index]),
        value,
        value === null ? (hasSeenValue ? "BLANK" : "DASH") : "VALUE",
      );
    }
  }
  await point(a36, "CHINESE", "610", "3.4", "SOURCE_EXCEPTION");

  const a37 = await ensureTable(
    currentRule.rows[0].id,
    "A-37",
    { diningType: "enum", field: "enum" },
    { WmPrime: "L/person", t: "min/day", gu: "g/person", gb: "g/person" },
  );
  for (const [type, factors] of Object.entries(currentDinerFactors)) {
    for (const [key, value] of Object.entries(factors))
      await point(a37, type, key, value);
  }

  const legacyWater = await ensureTable(
    legacyRule.rows[0].id,
    "LEGACY-WATER",
    { category: "enum", field: "enum" },
    { q: "L/(person·meal)", turnover: "ratio", density: "person/m2" },
  );
  for (const [type, factors] of Object.entries(legacyWaterFactors)) {
    for (const key of ["qMin", "qMax", "turnover", "density"] as const) {
      const value = factors[key];
      await point(
        legacyWater,
        type,
        key,
        value,
        value === null ? "BLANK" : "VALUE",
      );
    }
  }

  const legacyK = await ensureTable(
    legacyRule.rows[0].id,
    "LEGACY-K",
    { class: "enum", option: "index" },
    { k: "ratio" },
  );
  for (const [type, values] of Object.entries(legacySafetyFactors)) {
    for (const [index, value] of values.entries())
      await point(legacyK, type, String(index + 1), value);
  }

  await client.query("COMMIT");
  console.log(
    `Seeded rules: ${currentRuleChecksum.slice(0, 12)}, ${legacyRuleChecksum.slice(0, 12)}`,
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
