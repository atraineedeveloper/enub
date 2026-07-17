BEGIN;

SET search_path = public, extensions;

-- Behavioral + structural coverage for the ownership-scoped
-- schedule_teachers SELECT policies introduced by
-- 20260716215631_schedule_ownership_rls_policies.sql. Mirrors
-- schedule_assignments_ownership_rls.test.sql: verifies that the open
-- "Enable read access for all users" policy is gone, that admin/staff see
-- every row (including worker-less rows), that a worker session only sees
-- their own rows, that anonymous/no-profile/malformed sessions see
-- nothing, and that INSERT/UPDATE/DELETE remain exactly as unrestricted as
-- before -- exercised via real RLS enforcement, not just policy metadata.

SELECT plan(23);

CREATE TEMP TABLE st_ownership_ids AS
WITH worker_a AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA ST Ownership Worker A', 'QA', 1)
    RETURNING id
),
worker_b AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA ST Ownership Worker B', 'QA', 1)
    RETURNING id
),
semester_insert AS (
    INSERT INTO public.semesters (semester, school_year)
    VALUES ('QA ST Ownership', '2026-2027')
    RETURNING id
)
SELECT
    worker_a.id AS worker_a_id,
    worker_b.id AS worker_b_id,
    semester_insert.id AS semester_id
FROM worker_a, worker_b, semester_insert;

-- Captured into psql variables (not re-queried later) because this temp
-- table is only accessible to the connecting role -- later statements in
-- this file run under `SET LOCAL role authenticated`, which cannot see it.
SELECT worker_a_id, worker_b_id, semester_id FROM st_ownership_ids \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'st-ownership-admin@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'st-ownership-staff@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'st-ownership-worker-a@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'st-ownership-worker-b@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'st-ownership-noprofile@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id) VALUES
    ('e2000000-0000-0000-0000-000000000001', 'admin', NULL),
    ('e2000000-0000-0000-0000-000000000002', 'staff', NULL);

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'e2000000-0000-0000-0000-000000000003', 'worker', worker_a_id FROM st_ownership_ids;

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'e2000000-0000-0000-0000-000000000004', 'worker', worker_b_id FROM st_ownership_ids;

-- e2000000-...-005 intentionally has no profiles row (the "missing profile" session).

-- Fixture rows: one owned by worker A, one owned by worker B, one
-- worker-less (worker_id NULL, e.g. an unassigned slot). Distinguished by
-- activity so tests can target a specific row without relying on
-- worker_id filters alone.
INSERT INTO public.schedule_teachers (weekday, activity, worker_id, semester_id)
SELECT 'Lunes', 'QA-Activity-A', worker_a_id, semester_id FROM st_ownership_ids;

INSERT INTO public.schedule_teachers (weekday, activity, worker_id, semester_id)
SELECT 'Martes', 'QA-Activity-B', worker_b_id, semester_id FROM st_ownership_ids;

INSERT INTO public.schedule_teachers (weekday, activity, worker_id, semester_id)
SELECT 'Miercoles', 'QA-Activity-Null', NULL, semester_id FROM st_ownership_ids;

-- Admin sees every row, including the worker-less one.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000001';
SELECT (SELECT count(*) FROM public.schedule_teachers WHERE semester_id = :'semester_id'::bigint) AS admin_visible_count \gset
SELECT (SELECT count(*) FROM public.schedule_teachers WHERE semester_id = :'semester_id'::bigint AND worker_id IS NULL) AS admin_sees_null_owned \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'admin_visible_count'::bigint, 3::bigint, 'an admin session sees every schedule_teachers row');
SELECT is(:'admin_sees_null_owned'::bigint, 1::bigint, 'an admin session sees the worker-less row');

-- Staff sees every row too.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000002';
SELECT (SELECT count(*) FROM public.schedule_teachers WHERE semester_id = :'semester_id'::bigint) AS staff_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'staff_visible_count'::bigint, 3::bigint, 'a staff session sees every schedule_teachers row');

-- Worker A sees only their own row: not worker B's, not the null-owned one.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000003';
SELECT (SELECT count(*) FROM public.schedule_teachers) AS worker_a_visible_count \gset
SELECT (SELECT count(*) FROM public.schedule_teachers WHERE activity = 'QA-Activity-B') AS worker_a_sees_worker_b \gset
SELECT (SELECT count(*) FROM public.schedule_teachers WHERE worker_id = :'worker_b_id'::bigint) AS worker_a_filtered_by_worker_b \gset
SELECT (SELECT count(*) FROM public.schedule_teachers WHERE worker_id IS NULL) AS worker_a_sees_null_owned \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'worker_a_visible_count'::bigint, 1::bigint, 'worker A session sees exactly one schedule_teachers row (no explicit filter needed)');
SELECT is(:'worker_a_sees_worker_b'::bigint, 0::bigint, 'worker A session cannot see worker B''s row by its activity marker');
SELECT is(:'worker_a_filtered_by_worker_b'::bigint, 0::bigint, 'worker A session filtered explicitly by worker B''s worker_id returns zero rows');
SELECT is(:'worker_a_sees_null_owned'::bigint, 0::bigint, 'worker A session cannot see the worker-less row');

-- Worker B sees only their own row (ownership check is symmetric).
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000004';
SELECT (SELECT count(*) FROM public.schedule_teachers) AS worker_b_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'worker_b_visible_count'::bigint, 1::bigint, 'worker B session sees exactly one schedule_teachers row');

-- Anonymous (no authenticated session at all) is denied.
SET LOCAL role anon;
SELECT (SELECT count(*) FROM public.schedule_teachers WHERE semester_id = :'semester_id'::bigint) AS anon_visible_count \gset
RESET role;

SELECT is(:'anon_visible_count'::bigint, 0::bigint, 'an anonymous session sees no schedule_teachers rows');

-- A real auth.users row with no profiles row (missing profile) is denied.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000005';
SELECT (SELECT count(*) FROM public.schedule_teachers WHERE semester_id = :'semester_id'::bigint) AS noprofile_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'noprofile_visible_count'::bigint, 0::bigint, 'a session with no profiles row sees no schedule_teachers rows');

-- "Unknown role" and "invalid/missing worker link" are not reachable states
-- in this schema: profiles_role_check restricts role to admin/staff/worker,
-- and profiles_worker_role_consistency forbids a worker-role profile with a
-- NULL worker_id. Assert the schema itself closes off both states, which is
-- why current_app_role()/current_worker_id() (and therefore these SELECT
-- policies) never have to handle them.
SELECT throws_ok(
    $$INSERT INTO public.profiles (id, role, worker_id) VALUES ('e2000000-0000-0000-0000-000000000009', 'manager', NULL)$$,
    '23514',
    NULL,
    'the profiles role check constraint rejects an unrecognized role value'
);

SELECT throws_ok(
    $$INSERT INTO public.profiles (id, role, worker_id) VALUES ('e2000000-0000-0000-0000-000000000009', 'worker', NULL)$$,
    '23514',
    NULL,
    'the profiles worker/role consistency check rejects a worker-role profile with no worker_id'
);

-- Structural: the old unrestricted policy is gone, and nothing else
-- unrestricted has taken its place under any name.
SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'schedule_teachers'
            AND cmd = 'SELECT'
            AND policyname = 'Enable read access for all users'
    ),
    'the old unrestricted "Enable read access for all users" SELECT policy no longer exists on schedule_teachers'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'schedule_teachers'
            AND cmd = 'SELECT'
            AND (
                qual = 'true'
                OR 'public' = ANY(roles)
                OR 'anon' = ANY(roles)
            )
    ),
    'no unrestricted or anon/public SELECT policy exists on schedule_teachers under any name'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'schedule_teachers'
            AND cmd = 'SELECT'
            AND permissive = 'PERMISSIVE'
            AND roles = ARRAY['authenticated']::name[]
            AND qual = '(current_app_role() = ANY (ARRAY[''staff''::text, ''admin''::text]))'
    ),
    'the admin/staff full-read SELECT policy exists on schedule_teachers with the expected shape'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'schedule_teachers'
            AND cmd = 'SELECT'
            AND permissive = 'PERMISSIVE'
            AND roles = ARRAY['authenticated']::name[]
            AND qual = '(worker_id = current_worker_id())'
    ),
    'the worker-own-row SELECT policy exists on schedule_teachers with the expected shape'
);

SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND cmd = 'SELECT'),
    2,
    'exactly two SELECT policies exist on schedule_teachers'
);

-- Structural: INSERT/UPDATE/DELETE policy metadata is untouched by the migration.
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'schedule_teachers'
            AND policyname = 'Enable create access for all users'
            AND cmd = 'INSERT' AND permissive = 'PERMISSIVE'
            AND roles = ARRAY['public']::name[] AND with_check = 'true'
    ),
    'the schedule_teachers INSERT policy is unchanged'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'schedule_teachers'
            AND policyname = 'Enable update access for all users'
            AND cmd = 'UPDATE' AND permissive = 'PERMISSIVE'
            AND roles = ARRAY['public']::name[] AND qual = 'true' AND with_check = 'true'
    ),
    'the schedule_teachers UPDATE policy is unchanged'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'schedule_teachers'
            AND policyname = 'Enable delete access for all users'
            AND cmd = 'DELETE' AND permissive = 'PERMISSIVE'
            AND roles = ARRAY['public']::name[] AND qual = 'true'
    ),
    'the schedule_teachers DELETE policy is unchanged'
);

-- Behavioral: writes still work exactly as before (open policies, no
-- ownership check) -- exercised under an authenticated worker session.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000003';

SELECT lives_ok(
    format(
        $$INSERT INTO public.schedule_teachers (weekday, activity, worker_id, semester_id) VALUES ('Jueves', 'QA-Activity-Insert', %L, %L)$$,
        :'worker_a_id',
        :'semester_id'
    ),
    'writes to schedule_teachers still succeed (INSERT policy unchanged)'
);

SELECT lives_ok(
    $$UPDATE public.schedule_teachers SET activity = 'QA-Activity-Updated' WHERE activity = 'QA-Activity-Insert'$$,
    'writes to schedule_teachers still succeed (UPDATE policy unchanged)'
);

SELECT lives_ok(
    $$DELETE FROM public.schedule_teachers WHERE activity = 'QA-Activity-Updated'$$,
    'writes to schedule_teachers still succeed (DELETE policy unchanged)'
);

RESET role;
RESET "request.jwt.claim.sub";

SELECT * FROM finish();

ROLLBACK;
