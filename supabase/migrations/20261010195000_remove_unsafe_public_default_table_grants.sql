-- New public tables created by the postgres migration role must grant API access explicitly.
-- This avoids automatically granting anon/authenticated table privileges, including TRUNCATE.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
