BEGIN;

SET search_path = public, extensions;

-- Current authorization coverage after the ownership-scoped SELECT migration
-- and the later P0 hardening migration. Anonymous clients have no table
-- privileges at all; authenticated workers can read only their own rows;
-- staff/admin can read all rows and are the only roles allowed to write.
SELECT plan(24);

CREATE TEMP TABLE sa_ownership_ids AS
WITH worker_a AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA SA Ownership Worker A', 'QA', 1)
    RETURNING id
),
worker_b AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA SA Ownership Worker B', 'QA', 1)
    RETURNING id
),
semester_insert AS (
    INSERT INTO public.semesters (semester, school_year)
    VALUES ('QA SA Ownership', '2026-2027')
    RETURNING id
)
SELECT
    worker_a.id AS worker_a_id,
    worker_b.id AS worker_b_id,
    semester_insert.id AS semester_id
FROM worker_a, worker_b, semester_insert;

SELECT worker_a_id, worker_b_id, semester_id FROM sa_ownership_ids \gset

INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'sa-ownership-admin@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sa-ownership-staff@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'sa-ownership-worker-a@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'sa-ownership-worker-b@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'sa-ownership-noprofile@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'sa-ownership-invalid@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id) VALUES
    ('e1000000-0000-0000-0000-000000000001', 'admin', NULL),
    ('e1000000-0000-0000-0000-000000000002', 'staff', NULL);

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'e1000000-0000-0000-0000-000000000003', 'worker', worker_a_id FROM sa_ownership_ids;

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'e1000000-0000-0000-0000-000000000004', 'worker', worker_b_id FROM sa_ownership_ids;

INSERT INTO public.schedule_assignments (weekday, worker_id, semester_id)
SELECT 'QA-Lunes-A', worker_a_id, semester_id FROM sa_ownership_ids;

INSERT INTO public.schedule_assignments (weekday, worker_id, semester_id)
SELECT 'QA-Martes-B', worker_b_id, semester_id FROM sa_ownership_ids;

INSERT INTO public.schedule_assignments (weekday, worker_id, semester_id)
SELECT 'QA-Miercoles-Null', NULL, semester_id FROM sa_ownership_ids;

-- Admin sees every row, including an unassigned slot.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e1000000-0000-0000-0000-000000000001';
SELECT (SELECT count(*) FROM public.schedule_assignments WHERE semester_id = :'semester_id'::bigint) AS admin_visible_count \gset
SELECT (SELECT count(*) FROM public.schedule_assignments WHERE semester_id = :'semester_id'::bigint AND worker_id IS NULL) AS admin_sees_null_owned \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'admin_visible_count'::bigint, 3::bigint, 'admin sees every schedule_assignments row');
SELECT is(:'admin_sees_null_owned'::bigint, 1::bigint, 'admin sees the worker-less schedule_assignments row');

-- Staff has the same read scope.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e1000000-0000-0000-0000-000000000002';
SELECT (SELECT count(*) FROM public.schedule_assignments WHERE semester_id = :'semester_id'::bigint) AS staff_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'staff_visible_count'::bigint, 3::bigint, 'staff sees every schedule_assignments row');

-- Workers see only their own row.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e1000000-0000-0000-0000-000000000003';
SELECT (SELECT count(*) FROM public.schedule_assignments) AS worker_a_visible_count \gset
SELECT (SELECT count(*) FROM public.schedule_assignments WHERE weekday = 'QA-Martes-B') AS worker_a_sees_worker_b \gset
SELECT (SELECT count(*) FROM public.schedule_assignments WHERE worker_id IS NULL) AS worker_a_sees_null_owned \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'worker_a_visible_count'::bigint, 1::bigint, 'worker A sees exactly one schedule_assignments row');
SELECT is(:'worker_a_sees_worker_b'::bigint, 0::bigint, 'worker A cannot see worker B schedule_assignments rows');
SELECT is(:'worker_a_sees_null_owned'::bigint, 0::bigint, 'worker A cannot see worker-less schedule_assignments rows');

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e1000000-0000-0000-0000-000000000004';
SELECT (SELECT count(*) FROM public.schedule_assignments) AS worker_b_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'worker_b_visible_count'::bigint, 1::bigint, 'worker B sees exactly one schedule_assignments row');

-- P0 hardening removed anonymous table privileges entirely. Do not perform a
-- SELECT as anon here: permission denial before RLS is the intended boundary.
SELECT ok(
    NOT has_table_privilege('anon', 'public.schedule_assignments', 'SELECT')
    AND NOT has_table_privilege('anon', 'public.schedule_assignments', 'INSERT')
    AND NOT has_table_privilege('anon', 'public.schedule_assignments', 'UPDATE')
    AND NOT has_table_privilege('anon', 'public.schedule_assignments', 'DELETE'),
    'anon has no schedule_assignments DML privileges'
);

-- An authenticated account without an application profile fails closed via RLS.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e1000000-0000-0000-0000-000000000005';
SELECT (SELECT count(*) FROM public.schedule_assignments WHERE semester_id = :'semester_id'::bigint) AS noprofile_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'noprofile_visible_count'::bigint, 0::bigint, 'an authenticated session with no profile sees no schedule_assignments rows');

SELECT throws_ok(
    $$INSERT INTO public.profiles (id, role, worker_id) VALUES ('e1000000-0000-0000-0000-000000000009', 'manager', NULL)$$,
    '23514',
    NULL,
    'profiles rejects an unrecognized role value'
);

SELECT throws_ok(
    $$INSERT INTO public.profiles (id, role, worker_id) VALUES ('e1000000-0000-0000-0000-000000000009', 'worker', NULL)$$,
    '23514',
    NULL,
    'profiles rejects a worker role with no worker_id'
);

-- Current SELECT policy shape: authenticated staff/admin full read plus
-- authenticated worker-owned read. There are no public/anon policies.
SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'schedule_assignments'
          AND policyname = 'Enable read access for all users'
    ),
    'legacy unrestricted schedule_assignments SELECT policy is absent'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'schedule_assignments'
          AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
    ),
    'schedule_assignments has no public or anon policies'
);

SELECT is(
    (SELECT count(*)::int FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'schedule_assignments'
       AND cmd = 'SELECT'
       AND roles = ARRAY['authenticated']::name[]),
    2,
    'schedule_assignments has exactly two authenticated SELECT policies'
);

SELECT is(
    (SELECT count(*)::int FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'schedule_assignments'
       AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
       AND roles = ARRAY['authenticated']::name[]),
    3,
    'schedule_assignments has exactly three authenticated write policies'
);

SELECT is(
    (SELECT count(*)::int FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'schedule_assignments'
       AND policyname IN (
           'Staff and admin create schedule assignments',
           'Staff and admin update schedule assignments',
           'Staff and admin delete schedule assignments'
       )),
    3,
    'schedule_assignments has the expected staff/admin write policies'
);

SELECT ok(
    has_table_privilege('authenticated', 'public.schedule_assignments', 'SELECT')
    AND has_table_privilege('authenticated', 'public.schedule_assignments', 'INSERT')
    AND has_table_privilege('authenticated', 'public.schedule_assignments', 'UPDATE')
    AND has_table_privilege('authenticated', 'public.schedule_assignments', 'DELETE'),
    'authenticated retains the DML grants needed for RLS-controlled access'
);

SELECT ok(
    NOT has_sequence_privilege('anon', 'public.schedule_assignments_id_seq', 'USAGE')
    AND NOT has_sequence_privilege('anon', 'public.schedule_assignments_id_seq', 'SELECT'),
    'anon has no schedule_assignments identity-sequence privileges'
);

-- Worker writes fail closed. INSERT raises RLS; UPDATE/DELETE see zero rows
-- under the staff/admin-only write policies.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e1000000-0000-0000-0000-000000000003';

SELECT throws_ok(
    format(
        $$INSERT INTO public.schedule_assignments (weekday, worker_id, semester_id) VALUES ('QA-Worker-Insert', %L, %L)$$,
        :'worker_a_id',
        :'semester_id'
    ),
    '42501',
    NULL,
    'worker cannot insert schedule_assignments rows'
);

WITH updated AS (
    UPDATE public.schedule_assignments
    SET weekday = 'QA-Worker-Updated'
    WHERE weekday = 'QA-Lunes-A'
    RETURNING 1
)
SELECT count(*) AS worker_update_count FROM updated \gset

WITH deleted AS (
    DELETE FROM public.schedule_assignments
    WHERE weekday = 'QA-Lunes-A'
    RETURNING 1
)
SELECT count(*) AS worker_delete_count FROM deleted \gset

RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'worker_update_count'::bigint, 0::bigint, 'worker cannot update schedule_assignments rows');
SELECT is(:'worker_delete_count'::bigint, 0::bigint, 'worker cannot delete schedule_assignments rows');

-- Staff write behavior remains available.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e1000000-0000-0000-0000-000000000002';

WITH inserted AS (
    INSERT INTO public.schedule_assignments (weekday, worker_id, semester_id)
    VALUES ('QA-Staff-Insert', :'worker_a_id'::bigint, :'semester_id'::bigint)
    RETURNING 1
)
SELECT count(*) AS staff_insert_count FROM inserted \gset

WITH updated AS (
    UPDATE public.schedule_assignments
    SET weekday = 'QA-Staff-Updated'
    WHERE weekday = 'QA-Staff-Insert'
    RETURNING 1
)
SELECT count(*) AS staff_update_count FROM updated \gset

WITH deleted AS (
    DELETE FROM public.schedule_assignments
    WHERE weekday = 'QA-Staff-Updated'
    RETURNING 1
)
SELECT count(*) AS staff_delete_count FROM deleted \gset

RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'staff_insert_count'::bigint, 1::bigint, 'staff can insert schedule_assignments rows');
SELECT is(:'staff_update_count'::bigint, 1::bigint, 'staff can update schedule_assignments rows');
SELECT is(:'staff_delete_count'::bigint, 1::bigint, 'staff can delete schedule_assignments rows');

SELECT * FROM finish();

ROLLBACK;
