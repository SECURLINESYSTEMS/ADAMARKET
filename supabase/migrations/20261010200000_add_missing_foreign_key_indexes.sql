DO $migration$
DECLARE
  r record;
  cols_sql text;
  idx_name text;
BEGIN
  FOR r IN
    SELECT c.conrelid, c.conkey,
           ns.nspname AS schema_name,
           rel.relname AS table_name,
           c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE c.contype = 'f'
      AND ns.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class ix ON ix.oid = i.indexrelid
        JOIN pg_am am ON am.oid = ix.relam
        WHERE i.indrelid = c.conrelid
          AND i.indisvalid
          AND i.indisready
          AND i.indpred IS NULL
          AND am.amname = 'btree'
          AND (
            SELECT array_agg(k.attnum::smallint ORDER BY k.ord)
            FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord)
            WHERE k.ord <= cardinality(c.conkey)
          ) = c.conkey
      )
    ORDER BY ns.nspname, rel.relname, c.conname
  LOOP
    SELECT string_agg(format('%I', a.attname), ', ' ORDER BY u.ord)
      INTO cols_sql
    FROM unnest(r.conkey) WITH ORDINALITY AS u(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = r.conrelid AND a.attnum = u.attnum;

    idx_name := left(r.table_name || '_' || replace(r.conname, r.table_name || '_', '') || '_fk_idx', 63);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
                   idx_name, r.schema_name, r.table_name, cols_sql);
  END LOOP;
END
$migration$;