BEGIN;

SET search_path = public, extensions;

SELECT plan(8);

SELECT is(
  (SELECT count(*)::integer
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('groups', 'semesters', 'utilities')
     AND c.relkind = 'r'
     AND c.relrowsecurity),
  3,
  'shared catalog tables have RLS enabled'
);

SELECT is(
  (SELECT count(*)::integer FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('groups', 'semesters', 'utilities')
     AND ('public' = ANY(roles) OR 'anon' = ANY(roles))),
  0,
  'shared catalog tables have no public or anon policies'
);

SELECT is(
  (SELECT count(*)::integer FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('groups', 'semesters', 'utilities')
     AND roles = ARRAY['authenticated']::name[]),
  6,
  'shared catalog tables have exactly six authenticated policies'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.groups', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.groups', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.groups', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.groups', 'DELETE')
  AND NOT has_table_privilege('anon', 'public.semesters', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.semesters', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.semesters', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.semesters', 'DELETE')
  AND NOT has_table_privilege('anon', 'public.utilities', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.utilities', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.utilities', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.utilities', 'DELETE'),
  'anon has no shared catalog DML privileges'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.groups', 'SELECT')
  AND has_table_privilege('authenticated', 'public.groups', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.groups', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.groups', 'DELETE'),
  'authenticated groups grants match the application contract'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.semesters', 'SELECT')
  AND has_table_privilege('authenticated', 'public.semesters', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.semesters', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.semesters', 'DELETE'),
  'authenticated semesters grants match the application contract'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.utilities', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.utilities', 'INSERT')
  AND has_table_privilege('authenticated', 'public.utilities', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.utilities', 'DELETE'),
  'authenticated utilities grants match the application contract'
);

SELECT ok(
  NOT has_sequence_privilege('anon', 'public.groups_id_seq', 'USAGE')
  AND NOT has_sequence_privilege('anon', 'public.semesters_id_seq', 'USAGE')
  AND NOT has_sequence_privilege('anon', 'public.utilities_id_seq', 'USAGE')
  AND has_sequence_privilege('authenticated', 'public.groups_id_seq', 'USAGE')
  AND has_sequence_privilege('authenticated', 'public.semesters_id_seq', 'USAGE')
  AND NOT has_sequence_privilege('authenticated', 'public.utilities_id_seq', 'USAGE'),
  'catalog sequence grants match the least-privilege model'
);

SELECT * FROM finish();

ROLLBACK;
