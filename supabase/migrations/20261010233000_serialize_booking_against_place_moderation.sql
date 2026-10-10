DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.create_booking(bigint,date,date)'::regprocedure)
    INTO v_definition;

  IF position('WHERE id = p_space_id;' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected ad_places lookup not found; refusing to modify create_booking';
  END IF;

  v_definition := replace(
    v_definition,
    'WHERE id = p_space_id;',
    'WHERE id = p_space_id
   FOR UPDATE;'
  );

  EXECUTE v_definition;
END
$migration$;
