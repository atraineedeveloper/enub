BEGIN;
SET search_path = public, extensions;
SELECT plan(8);
-- Simulate imported explicit IDs and stale allocators in a disposable local DB.
INSERT INTO public.workers(id,name) VALUES (900001,'QA imported identity');
INSERT INTO public.sustenance_plazas(id,worker_id,sustenance,payment_key,plaza) VALUES (900001,900001,'Federal','QA','QA');
INSERT INTO public.date_of_admissions(id,worker_id,type,date_of_admission) VALUES (900001,900001,'Ingreso','2024-01-01');
-- subjects has varying required columns: simulate drift against an existing or imported ID using a temporary clone of an actual row if present; allocator-ahead behavior is tested independently below.
ALTER SEQUENCE public.workers_id_seq RESTART WITH 1;
ALTER SEQUENCE public.sustenance_plazas_id_seq RESTART WITH 1;
ALTER SEQUENCE public.date_of_admissions_id_seq RESTART WITH 1;
ALTER SEQUENCE public.subject_id_seq RESTART WITH 900005;
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

SELECT ok((SELECT last_value > 900001 AND NOT is_called FROM public.workers_id_seq),'worker allocator advanced beyond imported ID');
SELECT ok((SELECT last_value > 900001 AND NOT is_called FROM public.sustenance_plazas_id_seq),'plaza allocator advanced beyond imported ID');
SELECT ok((SELECT last_value > 900001 AND NOT is_called FROM public.date_of_admissions_id_seq),'admission allocator advanced beyond imported ID');
SELECT ok((SELECT last_value >= 900005 AND NOT is_called FROM public.subject_id_seq),'already-ahead allocator never moved backward');
SELECT ok(EXISTS(SELECT 1 FROM public.workers WHERE id=900001),'imported worker preserved');
SELECT ok(EXISTS(SELECT 1 FROM public.sustenance_plazas WHERE id=900001 AND worker_id=900001),'imported plaza preserved');
SELECT ok(EXISTS(SELECT 1 FROM public.date_of_admissions WHERE id=900001 AND worker_id=900001),'imported admission preserved');
SELECT ok((SELECT last_value > coalesce((SELECT max(id) FROM public.subjects),0) FROM public.subject_id_seq),'subject allocator above existing IDs');
SELECT * FROM finish();
ROLLBACK;
