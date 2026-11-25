BEGIN;
SET search_path = public, extensions;
SELECT plan(9);
INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES ('00000000-0000-0000-0000-000000000000','52000000-0000-0000-0000-000000000001','authenticated','authenticated','atomic-admin@example.test','x',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','52000000-0000-0000-0000-000000000002','authenticated','authenticated','atomic-unassigned@example.test','x',now(),'{}','{}',now(),now());
INSERT INTO public.profiles(id,role,worker_id) VALUES ('52000000-0000-0000-0000-000000000001','admin',NULL);
SELECT ok(NOT has_function_privilege('anon','public.create_worker_with_relations(jsonb,jsonb,jsonb)','EXECUTE'),'anon cannot execute creation RPC');
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '52000000-0000-0000-0000-000000000001';
SELECT lives_ok($q$SELECT public.create_worker_with_relations('{"name":"Atomic QA","RFC":"ATOMICQA01","id":999999}'::jsonb,'[{"sustenance":"Federal","payment_key":"QA","plaza":"QA"}]'::jsonb,'[{"type":"Ingreso","date_of_admission":"2024-01-01"}]'::jsonb)$q$,'admin creates worker and relations');
SELECT is((SELECT count(*) FROM public.workers WHERE "RFC"='ATOMICQA01'),1::bigint,'worker persisted once');
SELECT ok((SELECT id <> 999999 FROM public.workers WHERE "RFC"='ATOMICQA01'),'client ID ignored');
SELECT is((SELECT count(*) FROM public.sustenance_plazas p JOIN public.workers w ON w.id=p.worker_id WHERE w."RFC"='ATOMICQA01'),1::bigint,'plaza persisted');
SELECT is((SELECT count(*) FROM public.date_of_admissions d JOIN public.workers w ON w.id=d.worker_id WHERE w."RFC"='ATOMICQA01'),1::bigint,'admission persisted');
SELECT throws_ok($q$SELECT public.create_worker_with_relations('{"name":"Rollback QA","RFC":"ATOMICQA02"}'::jsonb,'[{"sustenance":"Federal","payment_key":"QA","plaza":"QA"}]'::jsonb,'[{"type":"Ingreso","date_of_admission":"invalid"}]'::jsonb)$q$,'22007',NULL,'invalid admission rolls back transaction');
SELECT is((SELECT count(*) FROM public.workers WHERE "RFC"='ATOMICQA02'),0::bigint,'failed worker absent');
SET LOCAL "request.jwt.claim.sub" = '52000000-0000-0000-0000-000000000002';
SELECT throws_ok($q$SELECT public.create_worker_with_relations('{"name":"Forbidden QA","RFC":"ATOMICQA03"}'::jsonb)$q$,'WUP01',NULL,'unassigned user denied');
RESET role;
SELECT * FROM finish();
ROLLBACK;
