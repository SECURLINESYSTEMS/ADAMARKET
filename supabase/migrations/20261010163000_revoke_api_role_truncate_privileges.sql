-- RLS does not protect against TRUNCATE. Remove this privilege from API roles
-- across the public schema while preserving ordinary table operations governed by RLS.
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
