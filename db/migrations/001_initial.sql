CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_subject text UNIQUE,
  display_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'DISABLED')) DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('ENGINEER', 'RULE_ADMIN', 'SYSTEM_ADMIN')),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS source_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  authority_level text NOT NULL,
  published_at date,
  checked_at date NOT NULL,
  uri text NOT NULL,
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9A-F]{64}$'),
  status text NOT NULL CHECK (status IN ('ACTIVE', 'HISTORICAL', 'RETIRED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_discrepancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  source_document_id uuid NOT NULL REFERENCES source_documents(id),
  page text,
  description text NOT NULL,
  resolution text NOT NULL,
  approved_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  version text NOT NULL,
  method_family text NOT NULL CHECK (method_family IN ('CURRENT_QG', 'LEGACY_QV')),
  effective_from date,
  effective_to date,
  status text NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  checksum char(64) NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  source_document_id uuid NOT NULL REFERENCES source_documents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  UNIQUE (code, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_rule_set_per_family
  ON rule_sets(method_family) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS factor_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES rule_sets(id) ON DELETE RESTRICT,
  table_code text NOT NULL,
  dimension_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  unit_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (rule_set_id, table_code)
);

CREATE TABLE IF NOT EXISTS factor_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES factor_tables(id) ON DELETE RESTRICT,
  dining_type text NOT NULL,
  dimension_key text NOT NULL,
  value numeric(24,10),
  source_state text NOT NULL CHECK (source_state IN ('VALUE', 'DASH', 'BLANK', 'SOURCE_EXCEPTION')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK ((source_state IN ('VALUE', 'SOURCE_EXCEPTION') AND value IS NOT NULL) OR
         (source_state IN ('DASH', 'BLANK') AND value IS NULL)),
  UNIQUE (table_id, dining_type, dimension_key)
);

CREATE TABLE IF NOT EXISTS calculation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_group_id uuid NOT NULL,
  case_no text NOT NULL,
  revision_no integer NOT NULL CHECK (revision_no > 0),
  customer text NOT NULL,
  location text NOT NULL,
  title text NOT NULL,
  purpose text NOT NULL DEFAULT '',
  dining_type text,
  task_code text NOT NULL CHECK (task_code IN (
    'T01_DINERS_TO_FLOW', 'T02_DINERS_TO_DESIGN', 'T03_AREA_TO_FLOW',
    'T04_AREA_TO_DESIGN', 'T05_DESIGN_TO_DINERS_AND_AREA'
  )),
  mode text NOT NULL CHECK (mode IN ('CURRENT_QG', 'LEGACY_QV', 'DUAL_COMPARISON')),
  lifecycle_status text NOT NULL CHECK (lifecycle_status IN (
    'DRAFT', 'INPUT_READY', 'CALCULATED', 'IN_REVIEW', 'REVIEWED', 'ISSUED', 'SUPERSEDED'
  )) DEFAULT 'DRAFT',
  calculation_status text CHECK (calculation_status IN ('COMPLETE', 'COMPLETE_WITH_REMINDER', 'BLOCKED')),
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES users(id),
  prepared_by uuid REFERENCES users(id),
  reviewed_by uuid REFERENCES users(id),
  issued_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_group_id, revision_no),
  UNIQUE (case_no, revision_no)
);

CREATE INDEX IF NOT EXISTS calculation_cases_group_idx ON calculation_cases(case_group_id, revision_no DESC);

CREATE TABLE IF NOT EXISTS case_inputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_revision_id uuid NOT NULL REFERENCES calculation_cases(id) ON DELETE CASCADE,
  track text NOT NULL CHECK (track IN ('CURRENT_QG', 'LEGACY_QV')),
  field_code text NOT NULL,
  raw_value text NOT NULL,
  normalized_decimal numeric(24,10),
  unit text,
  source_type text,
  evidence_uri text,
  UNIQUE (case_revision_id, track, field_code)
);

CREATE TABLE IF NOT EXISTS scenario_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_revision_id uuid NOT NULL REFERENCES calculation_cases(id) ON DELETE CASCADE,
  selected_mode text NOT NULL,
  reason text NOT NULL,
  decided_by uuid NOT NULL REFERENCES users(id),
  decided_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_revision_id uuid NOT NULL REFERENCES calculation_cases(id) ON DELETE CASCADE,
  track text NOT NULL CHECK (track IN ('CURRENT_QG', 'LEGACY_QV')),
  code text NOT NULL,
  value jsonb NOT NULL,
  impact text NOT NULL,
  confirmed_by uuid NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS calculation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_revision_id uuid NOT NULL REFERENCES calculation_cases(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  payload_hash char(64) NOT NULL,
  response_json jsonb,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_revision_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS track_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES calculation_requests(id) ON DELETE RESTRICT,
  track text NOT NULL CHECK (track IN ('CURRENT_QG', 'LEGACY_QV')),
  status text NOT NULL CHECK (status IN ('CALCULATED', 'INSUFFICIENT_DATA', 'INVALID', 'ERROR')),
  required_fields_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_fields_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  errors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  rule_set_id uuid REFERENCES rule_sets(id),
  assessed_at timestamptz NOT NULL DEFAULT now(),
  release_relevance text NOT NULL DEFAULT '',
  UNIQUE (request_id, track)
);

CREATE TABLE IF NOT EXISTS calculation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES calculation_requests(id) ON DELETE RESTRICT,
  case_revision_id uuid NOT NULL REFERENCES calculation_cases(id) ON DELETE RESTRICT,
  track text NOT NULL CHECK (track IN ('CURRENT_QG', 'LEGACY_QV')),
  task_code text NOT NULL,
  method_code text NOT NULL,
  rule_set_id uuid NOT NULL REFERENCES rule_sets(id),
  input_hash char(64) NOT NULL,
  status text NOT NULL CHECK (status IN ('COMPLETED', 'VOID')) DEFAULT 'COMPLETED',
  result_semantics text NOT NULL,
  raw_result_json jsonb NOT NULL,
  adopted_result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, track)
);

CREATE TABLE IF NOT EXISTS calculation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES calculation_runs(id) ON DELETE RESTRICT,
  sequence integer NOT NULL CHECK (sequence > 0),
  formula_code text NOT NULL,
  expression text NOT NULL,
  substitution text NOT NULL,
  result numeric(24,10) NOT NULL,
  unit text NOT NULL,
  source_ref text NOT NULL,
  UNIQUE (run_id, sequence)
);

CREATE TABLE IF NOT EXISTS warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL,
  owner_id uuid NOT NULL,
  code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  track text,
  message text NOT NULL,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS engineering_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_revision_id uuid NOT NULL REFERENCES calculation_cases(id) ON DELETE RESTRICT,
  result_path text NOT NULL,
  before_value jsonb NOT NULL,
  after_value jsonb NOT NULL,
  reason text NOT NULL,
  evidence text NOT NULL,
  requested_by uuid NOT NULL REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_revision_id uuid NOT NULL REFERENCES calculation_cases(id) ON DELETE RESTRICT,
  prepared_by uuid NOT NULL REFERENCES users(id),
  reviewed_by uuid NOT NULL REFERENCES users(id),
  checklist_json jsonb NOT NULL,
  decision text NOT NULL CHECK (decision IN ('APPROVED', 'RETURNED')),
  note text NOT NULL DEFAULT '',
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_revision_id uuid NOT NULL REFERENCES calculation_cases(id) ON DELETE RESTRICT,
  snapshot_json jsonb NOT NULL,
  snapshot_hash char(64) NOT NULL,
  report_number text,
  status text NOT NULL CHECK (status IN ('PENDING', 'ISSUED', 'VOID')),
  pdf_path text,
  created_by uuid NOT NULL REFERENCES users(id),
  issued_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  issued_at timestamptz,
  UNIQUE (case_revision_id, snapshot_hash)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  before_hash char(64),
  after_hash char(64),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION prevent_immutable_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable after completion', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS active_rule_sets_immutable ON rule_sets;
CREATE TRIGGER active_rule_sets_immutable
  BEFORE UPDATE OR DELETE ON rule_sets
  FOR EACH ROW WHEN (OLD.status = 'ACTIVE')
  EXECUTE FUNCTION prevent_immutable_update();

DROP TRIGGER IF EXISTS completed_runs_immutable ON calculation_runs;
CREATE TRIGGER completed_runs_immutable
  BEFORE UPDATE OR DELETE ON calculation_runs
  FOR EACH ROW WHEN (OLD.status = 'COMPLETED')
  EXECUTE FUNCTION prevent_immutable_update();

DROP TRIGGER IF EXISTS issued_snapshots_immutable ON report_snapshots;
CREATE TRIGGER issued_snapshots_immutable
  BEFORE UPDATE OR DELETE ON report_snapshots
  FOR EACH ROW WHEN (OLD.status = 'ISSUED')
  EXECUTE FUNCTION prevent_immutable_update();

