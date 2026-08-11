BEGIN;

SET search_path = public, extensions;

SELECT plan(13);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.worker_access_email_corrections'::regclass),
  'worker_access_email_corrections has RLS enabled'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'worker_access_email_corrections'
      AND grantee IN ('PUBLIC', 'anon', 'authenticated')
  ),
  'worker_access_email_corrections has no direct client grants'
);

SELECT is(
  (SELECT count(*)::integer FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('roles', 'state_roles', 'schedule_assignments', 'schedule_teachers')
     AND ('public' = ANY(roles) OR 'anon' = ANY(roles))),
  0,
  'protected tables have no public or anon policies'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.roles', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.roles', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.roles', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.roles', 'DELETE'),
  'anon has no roles DML privileges'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.state_roles', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.state_roles', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.state_roles', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.state_roles', 'DELETE'),
  'anon has no state_roles DML privileges'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.schedule_assignments', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.schedule_assignments', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.schedule_assignments', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.schedule_assignments', 'DELETE'),
  'anon has no schedule_assignments DML privileges'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.schedule_teachers', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.schedule_teachers', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.schedule_teachers', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.schedule_teachers', 'DELETE'),
  'anon has no schedule_teachers DML privileges'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.current_app_role()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.current_worker_id()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.grant_staff_role(text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.link_worker_account(bigint,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.unlink_worker_account(bigint)', 'EXECUTE'),
  'anon cannot execute protected SECURITY DEFINER functions'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.current_app_role()', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.current_worker_id()', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.grant_staff_role(text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.link_worker_account(bigint,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.unlink_worker_account(bigint)', 'EXECUTE'),
  'authenticated retains required function execution'
);

SELECT is(
  (SELECT count(*)::integer FROM pg_policies
   WHERE schemaname='public' AND tablename='roles'
     AND roles=ARRAY['authenticated']::name[]),
  2,
  'roles has staff/admin management and worker-own read policies'
);

SELECT is(
  (SELECT count(*)::integer FROM pg_policies
   WHERE schemaname='public' AND tablename='state_roles'
     AND roles=ARRAY['authenticated']::name[]),
  1,
  'state_roles has one authenticated staff/admin management policy'
);

SELECT is(
  (SELECT count(*)::integer FROM pg_policies
   WHERE schemaname='public' AND tablename='schedule_assignments'
     AND cmd IN ('INSERT','UPDATE','DELETE')
     AND roles=ARRAY['authenticated']::name[]),
  3,
  'schedule_assignments has three authenticated write policies'
);

SELECT is(
  (SELECT count(*)::integer FROM pg_policies
   WHERE schemaname='public' AND tablename='schedule_teachers'
     AND cmd IN ('INSERT','UPDATE','DELETE')
     AND roles=ARRAY['authenticated']::name[]),
  3,
  'schedule_teachers has three authenticated write policies'
);

SELECT * FROM finish();

ROLLBACK;
