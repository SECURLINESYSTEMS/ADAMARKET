-- Prevent future public-schema tables created by the current migration owner from granting TRUNCATE to API roles by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon, authenticated;
