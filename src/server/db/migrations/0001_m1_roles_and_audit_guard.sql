-- Role catalogue. Permissions per role live in src/server/auth/permissions.ts.
INSERT INTO "roles" ("key", "label", "is_staff") VALUES
  ('customer', 'Kundin/Kunde', false),
  ('admin', 'Admin', true),
  ('support', 'Kundenservice', true),
  ('editor', 'Redaktion', true),
  ('accounting', 'Buchhaltung', true),
  ('report_approver', 'Berichtsfreigabe', true)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
-- audit_log is append-only (CLAUDE.md §6).
CREATE OR REPLACE FUNCTION audit_log_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_block_mutation();
