DROP TRIGGER IF EXISTS completed_runs_immutable ON calculation_runs;
CREATE TRIGGER completed_runs_immutable
  BEFORE UPDATE ON calculation_runs
  FOR EACH ROW WHEN (OLD.status = 'COMPLETED')
  EXECUTE FUNCTION prevent_immutable_update();

DROP TRIGGER IF EXISTS issued_snapshots_immutable ON report_snapshots;
CREATE TRIGGER issued_snapshots_immutable
  BEFORE UPDATE ON report_snapshots
  FOR EACH ROW WHEN (OLD.status = 'ISSUED')
  EXECUTE FUNCTION prevent_immutable_update();
