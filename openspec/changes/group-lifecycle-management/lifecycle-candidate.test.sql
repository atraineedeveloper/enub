-- Isolated QA only. All fixtures roll back. Run after both SQL candidates.
BEGIN;
SET search_path = public, extensions;
SELECT plan(16);
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
('00000000-0000-0000-0000-000000000000','58000000-0000-0000-0000-000000000001','authenticated','authenticated','groups-admin@example.test','x',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','58000000-0000-0000-0000-000000000002','authenticated','authenticated','groups-staff@example.test','x',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','58000000-0000-0000-0000-000000000003','authenticated','authenticated','groups-unassigned@example.test','x',now(),'{}','{}',now(),now());
INSERT INTO public.profiles(id,role,worker_id) VALUES
('58000000-0000-0000-0000-000000000001','admin',NULL),
('58000000-0000-0000-0000-000000000002','staff',NULL);
INSERT INTO public.degrees(code,name) VALUES ('GLQA','Group lifecycle QA') RETURNING id AS degree_id \gset
SELECT ok(NOT has_function_privilege('anon','public.delete_group(bigint,integer,text)','EXECUTE'),'anonymous delete denied');
SELECT ok(NOT has_table_privilege('authenticated','group_admin_private.events','INSERT'),'audit insert denied');
SELECT ok(NOT has_table_privilege('authenticated','public.groups','UPDATE'),'direct update denied');
SELECT ok(NOT has_column_privilege('authenticated','public.groups','version','INSERT'),'version spoof denied');
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '58000000-0000-0000-0000-000000000001';
INSERT INTO public.groups(year_of_admission,letter,degree_id) VALUES (2091,' qa ',:degree_id) RETURNING id AS group_id \gset
SELECT is((SELECT letter::text FROM public.groups WHERE id=:group_id),'QA','letter normalized');
SELECT is((SELECT version FROM public.groups WHERE id=:group_id),1,'initial version');
SELECT is((public.archive_group(:group_id,1,'QA archive')).version,2,'archive increments version');
SELECT throws_ok(format('SELECT public.restore_group(%s,1,%L)',:group_id,'stale'),'GRP01',NULL,'stale version rejected');
SELECT is((public.restore_group(:group_id,2,'QA restore')).version,3,'reactivation increments version');
SELECT is((public.update_group(:group_id,3,2092,'QB',:degree_id)).year_of_admission,2092,'safe identity edit');
SET LOCAL "request.jwt.claim.sub" = '58000000-0000-0000-0000-000000000002';
SELECT throws_ok(format('SELECT public.delete_group(%s,4,%L)',:group_id,'staff attempt'),'42501',NULL,'staff cannot delete');
SELECT throws_ok('SELECT * FROM public.get_group_audit()','42501',NULL,'staff cannot view audit');
SET LOCAL "request.jwt.claim.sub" = '58000000-0000-0000-0000-000000000003';
SELECT throws_ok(format('SELECT public.archive_group(%s,4,%L)',:group_id,'unassigned attempt'),'42501',NULL,'unassigned cannot archive');
SET LOCAL "request.jwt.claim.sub" = '58000000-0000-0000-0000-000000000001';
SELECT is((public.delete_group(:group_id,4,'QA delete')).id,:group_id::bigint,'admin deletes unreferenced group');
SELECT is((SELECT count(*) FROM public.groups WHERE id=:group_id),0::bigint,'group removed');
SELECT is((SELECT count(*) FROM public.get_group_audit(:group_id)),5::bigint,'five audit events survive deletion');
RESET role;
SELECT * FROM finish();
ROLLBACK;
