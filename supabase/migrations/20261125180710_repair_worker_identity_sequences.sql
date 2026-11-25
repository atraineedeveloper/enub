SET LOCAL lock_timeout = '5s';
-- Candidate for a CLI-generated standalone migration. Execute only after review.
-- Locks prevent ordinary concurrent inserts while computing restart targets.
LOCK TABLE public.workers, public.sustenance_plazas, public.date_of_admissions, public.subjects IN ACCESS EXCLUSIVE MODE;
DO $repair$
DECLARE
  item record;
  seq regclass;
  max_id bigint;
  seq_last bigint;
  seq_called boolean;
  target bigint;
BEGIN
  FOR item IN SELECT unnest(ARRAY['workers','sustenance_plazas','date_of_admissions','subjects']) AS table_name LOOP
    seq := pg_get_serial_sequence(format('public.%I', item.table_name), 'id')::regclass;
    IF seq IS NULL THEN RAISE EXCEPTION 'Missing identity sequence for %', item.table_name; END IF;
    EXECUTE format('SELECT max(id) FROM public.%I', item.table_name) INTO max_id;
    EXECUTE format('SELECT last_value, is_called FROM %s', seq) INTO seq_last, seq_called;
    target := greatest(coalesce(max_id + 1, 1), seq_last + CASE WHEN seq_called THEN 1 ELSE 0 END);
    EXECUTE format('ALTER SEQUENCE %s RESTART WITH %s', seq, target);
  END LOOP;
END
$repair$;
