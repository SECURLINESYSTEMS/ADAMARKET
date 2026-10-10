-- Revoke the global default TRUNCATE grant for API roles for tables created by the current migration owner.
ALTER DEFAULT PRIVILEGES REVOKE TRUNCATE ON TABLES FROM anon, authenticated;
