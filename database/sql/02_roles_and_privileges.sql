-- Least privilege roles and permissions setup for CareSmart application

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'caresmart_app') THEN
        CREATE ROLE caresmart_app WITH LOGIN PASSWORD 'caresmart_app_secure_pass';
    END IF;
END
$$;

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO caresmart_app;

-- Grant standard DML to app user on all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO caresmart_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO caresmart_app;

-- Explicitly revoke UPDATE and DELETE on AuditLog from app role as an extra safety measure
REVOKE UPDATE, DELETE ON "AuditLog" FROM caresmart_app;
