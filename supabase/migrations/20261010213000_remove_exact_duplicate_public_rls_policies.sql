DO $migration$
DECLARE
  r record;
  policy_name text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, permissive, roles, cmd, qual, with_check,
           array_agg(policyname ORDER BY policyname) AS policy_names
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename, permissive, roles, cmd, qual, with_check
    HAVING count(*) > 1
  LOOP
    FOREACH policy_name IN ARRAY r.policy_names[2:array_length(r.policy_names, 1)]
    LOOP
      EXECUTE format('DROP POLICY %I ON %I.%I', policy_name, r.schemaname, r.tablename);
    END LOOP;
  END LOOP;
END
$migration$;
