-- btree_gist is relocatable; move it out of the exposed public schema.
-- Existing indexes/constraints retain their object dependencies when an extension is relocated.
ALTER EXTENSION btree_gist SET SCHEMA extensions;
