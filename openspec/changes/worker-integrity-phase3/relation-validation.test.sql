BEGIN;
SET search_path = public, extensions;
SELECT plan(7);
INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES ('00000000-0000-0000-0000-000000000000','53000000-0000-0000-0000-000000000001','authenticated','authenticated','relations-admin@example.test','x',now(),'{}','{}',now(),now());
INSERT INTO public.profiles(id,role,worker_id) VALUES ('53000000-0000-0000-0000-000000000001','admin',NULL);
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '53000000-0000-0000-0000-000000000001';
SELECT throws_ok($q$SELECT public.create_worker_with_relations('{"name":"QA","RFC":"QA-RELATION"}'::jsonb,'[{"sustenance":"Federal","payment_key":"X","plaza":"A"},{"sustenance":"Federal","payment_key":" X ","plaza":"B"}]'::jsonb)$q$,'WUP03',NULL,'duplicate payment key rejected');
SELECT throws_ok($q$SELECT public.create_worker_with_relations('{"name":"QA","RFC":"QA-RELATION"}'::jsonb,'[{"sustenance":"Federal","payment_key":"X"}]'::jsonb)$q$,'WUP03',NULL,'incomplete plaza rejected');
SELECT throws_ok($q$SELECT public.create_worker_with_relations('{"name":"QA","RFC":"QA-RELATION"}'::jsonb,NULL,'[{"type":"Ingreso","date_of_admission":"2024-01-01"},{"type":" ingreso ","date_of_admission":"2024-02-01"}]'::jsonb)$q$,'WUP04',NULL,'duplicate admission type rejected');
SELECT throws_ok($q$SELECT public.create_worker_with_relations('{"name":"QA","RFC":"QA-RELATION"}'::jsonb,NULL,'[{"type":"Ingreso"}]'::jsonb)$q$,'WUP04',NULL,'incomplete admission rejected');
SELECT is((SELECT count(*) FROM public.workers WHERE "RFC"='QA-RELATION'),0::bigint,'no partial worker persisted');
RESET role;
SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('Allow delete pictures 1pmf6kr_0','Allow update pictures 1pmf6kr_0','Allow upload pictures 1pmf6kr_0')),0::bigint,'legacy photo mutation policies removed');
SELECT is((SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('Staff admin upload worker photos','Staff admin update worker photos','Staff admin delete worker photos')),3::bigint,'role-limited photo policies installed');
SELECT * FROM finish();
ROLLBACK;
