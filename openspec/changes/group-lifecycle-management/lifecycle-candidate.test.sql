-- Isolated QA only. All fixtures roll back. Run after both SQL candidates.
BEGIN;
SET search_path = public, extensions;
SELECT plan(28);
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
-- Historical dependencies, direct bypass, duplicate, and audit rollback.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '58000000-0000-0000-0000-000000000001';
INSERT INTO public.groups(year_of_admission,letter,degree_id) VALUES (2093,'H',:degree_id) RETURNING id AS historical_id \gset
SELECT throws_ok(format('INSERT INTO public.groups(year_of_admission,letter,degree_id) VALUES (2093,%L,%s)',' h ',:degree_id),'23505',NULL,'normalized duplicate rejected');
SELECT throws_ok(format('UPDATE public.groups SET letter=%L WHERE id=%s','X',:historical_id),'42501',NULL,'direct update denied at runtime');
SELECT throws_ok(format('DELETE FROM public.groups WHERE id=%s',:historical_id),'42501',NULL,'direct delete denied at runtime');
INSERT INTO public.schedule_assignments(group_id,weekday,start_time,end_time) VALUES (:historical_id,'Martes','07:00','08:50') RETURNING id AS schedule_id \gset
SELECT throws_ok(format('SELECT public.delete_group(%s,1,%L)',:historical_id,'QA protected'),'GRP02',NULL,'referenced group cannot be deleted');
SELECT throws_ok(format('SELECT public.update_group(%s,1,2094,%L,%s)',:historical_id,'H',:degree_id),'GRP02',NULL,'historical identity cannot change');
SELECT is((public.archive_group(:historical_id,1,'QA historical archive')).version,2,'referenced group can be archived');
SELECT is((SELECT count(*) FROM public.schedule_assignments WHERE group_id=:historical_id),1::bigint,'historical schedule remains');
SELECT throws_ok(format('INSERT INTO public.schedule_assignments(group_id,weekday,start_time,end_time) VALUES (%s,%L,%L,%L)',:historical_id,'Jueves','07:00','08:50'),'GRP03',NULL,'new archived assignment rejected');
SELECT lives_ok(format('UPDATE public.schedule_assignments SET weekday=%L WHERE id=%s','Viernes',:schedule_id),'existing historical schedule may be corrected');
RESET role;
CREATE FUNCTION group_admin_private.qa_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN RAISE EXCEPTION 'QA simulated audit failure' USING ERRCODE='P0001'; END;
$fn$;
CREATE TRIGGER qa_reject_audit BEFORE INSERT ON group_admin_private.events FOR EACH ROW EXECUTE FUNCTION group_admin_private.qa_reject_audit();
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '58000000-0000-0000-0000-000000000001';
SELECT throws_ok(format('SELECT public.restore_group(%s,2,%L)',:historical_id,'QA rollback'),'P0001',NULL,'audit failure aborts mutation');
SELECT is((SELECT version FROM public.groups WHERE id=:historical_id),2,'version unchanged after rollback');
SELECT ok((SELECT archived_at IS NOT NULL FROM public.groups WHERE id=:historical_id),'archive preserved after rollback');
RESET role;
DROP TRIGGER qa_reject_audit ON group_admin_private.events;
DROP FUNCTION group_admin_private.qa_reject_audit();
SELECT * FROM finish();
ROLLBACK;
