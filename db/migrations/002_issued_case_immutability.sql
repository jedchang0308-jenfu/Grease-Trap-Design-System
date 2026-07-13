CREATE OR REPLACE FUNCTION protect_issued_case_revision() RETURNS trigger AS $$
BEGIN
  IF OLD.lifecycle_status = 'ISSUED' THEN
    IF NEW.case_no IS DISTINCT FROM OLD.case_no
       OR NEW.revision_no IS DISTINCT FROM OLD.revision_no
       OR NEW.customer IS DISTINCT FROM OLD.customer
       OR NEW.location IS DISTINCT FROM OLD.location
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.purpose IS DISTINCT FROM OLD.purpose
       OR NEW.dining_type IS DISTINCT FROM OLD.dining_type
       OR NEW.task_code IS DISTINCT FROM OLD.task_code
       OR NEW.mode IS DISTINCT FROM OLD.mode
       OR NEW.calculation_status IS DISTINCT FROM OLD.calculation_status
       OR NEW.input_payload IS DISTINCT FROM OLD.input_payload
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.prepared_by IS DISTINCT FROM OLD.prepared_by
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.issued_by IS DISTINCT FROM OLD.issued_by
       OR NEW.lifecycle_status NOT IN ('ISSUED', 'SUPERSEDED') THEN
      RAISE EXCEPTION 'issued calculation case revision is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS issued_case_revision_immutable ON calculation_cases;
CREATE TRIGGER issued_case_revision_immutable
  BEFORE UPDATE ON calculation_cases
  FOR EACH ROW
  EXECUTE FUNCTION protect_issued_case_revision();

