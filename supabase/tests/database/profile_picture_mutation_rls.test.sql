BEGIN;
SET search_path = public, extensions;
SELECT plan(8);
INSERT INTO storage.buckets(id,name,public) VALUES ('profile_pictures','profile_pictures',true) ON CONFLICT (id) DO NOTHING;
INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES ('00000000-0000-0000-0000-000000000000','54000000-0000-0000-0000-000000000001','authenticated','authenticated','photo-staff@example.test','x',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','54000000-0000-0000-0000-000000000002','authenticated','authenticated','photo-worker@example.test','x',now(),'{}','{}',now(),now());
INSERT INTO public.profiles(id,role,worker_id) VALUES ('54000000-0000-0000-0000-000000000001','staff',NULL);
WITH w AS (INSERT INTO public.workers(name) VALUES ('Photo QA') RETURNING id)
INSERT INTO public.profiles(id,role,worker_id) SELECT '54000000-0000-0000-0000-000000000002','worker',id FROM w;
INSERT INTO storage.objects(bucket_id,name) VALUES ('profile_pictures','qa-existing-photo.jpg');
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '54000000-0000-0000-0000-000000000002';
SELECT throws_ok($q$INSERT INTO storage.objects(bucket_id,name) VALUES ('profile_pictures','qa-forbidden.jpg')$q$,'42501',NULL,'worker cannot upload profile photos');
SELECT results_eq($q$WITH changed AS (UPDATE storage.objects SET name='qa-forbidden-update.jpg' WHERE bucket_id='profile_pictures' AND name='qa-existing-photo.jpg' RETURNING id) SELECT count(*) FROM changed$q$, ARRAY[0::bigint], 'worker cannot update photo');
-- The Storage engine rejects direct SQL DELETE even for authorized users.
SELECT ok(EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND cmd='DELETE' AND policyname='Staff admin delete worker photos' AND qual LIKE '%current_app_role%' AND qual LIKE '%staff%' AND qual LIKE '%admin%'),'photo delete policy is restricted by application role');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='profile_pictures' AND name='qa-existing-photo.jpg'),1::bigint,'existing authenticated read preserved');
SET LOCAL "request.jwt.claim.sub" = '54000000-0000-0000-0000-000000000001';
SELECT lives_ok($q$INSERT INTO storage.objects(bucket_id,name) VALUES ('profile_pictures','qa-staff-photo.jpg')$q$,'staff can upload photo');
SELECT results_eq($q$WITH changed AS (UPDATE storage.objects SET name='qa-staff-updated.jpg' WHERE bucket_id='profile_pictures' AND name='qa-staff-photo.jpg' RETURNING id) SELECT count(*) FROM changed$q$, ARRAY[1::bigint], 'staff can update photo');
SELECT throws_ok($q$DELETE FROM storage.objects WHERE bucket_id='profile_pictures' AND name='qa-staff-updated.jpg'$q$,NULL,NULL,'direct SQL deletion remains blocked even for staff');
RESET role;
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='profile_pictures' AND name='qa-existing-photo.jpg'),1::bigint,'original photo survives denied changes');
SELECT * FROM finish();
ROLLBACK;
