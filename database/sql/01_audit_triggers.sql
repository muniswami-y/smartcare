-- AuditLog append-only integrity triggers
-- Strictly blocks UPDATE and DELETE statements on the "AuditLog" table.

CREATE OR REPLACE FUNCTION block_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'AuditLog is append-only. Modification (UPDATE or DELETE) is strictly prohibited by hospital compliance policy and DPDP Act.'
    USING ERRCODE = 'restrict_violation';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_prevent_update ON "AuditLog";
CREATE TRIGGER trg_audit_log_prevent_update
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION block_audit_log_modification();

DROP TRIGGER IF EXISTS trg_audit_log_prevent_delete ON "AuditLog";
CREATE TRIGGER trg_audit_log_prevent_delete
BEFORE DELETE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION block_audit_log_modification();
