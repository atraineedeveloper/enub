BEGIN;

SET search_path = public, extensions;

-- Current authorization coverage after the ownership-scoped SELECT migration
-- and the later P0 hardening migration. Anonymous clients have no table
-- privileges at all; authenticated workers can read only their own rows;
-- staff/admin can read all rows and are the only roles allowed to write.
SELECT plan(24);

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

SELECT worker_a_id, worker_b_id, semester_id FROM st_ownership_ids \gset

INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'st-ownership-admin@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'st-ownership-staff@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'st-ownership-worker-a@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'st-ownership-worker-b@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'st-ownership-noprofile@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'st-ownership-invalid@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id) VALUES
    ('e2000000-0000-0000-0000-000000000001', 'admin', NULL),
    ('e2000000-0000-0000-0000-000000000002', 'staff', NULL);

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'e2000000-0000-0000-0000-000000000003', 'worker', worker_a_id FROM st_ownership_ids;

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'e2000000-0000-0000-0000-000000000004', 'worker', worker_b_id FROM st_ownership_ids;

INSERT INTO public.schedule_teachers (weekday, activity, worker_id, semester_id)
SELECT 'Lunes', 'QA-Activity-A', worker_a_id, semester_id FROM st_ownership_ids;

INSERT INTO public.schedule_teachers (weekday, activity, worker_id, semester_id)
SELECT 'Martes', 'QA-Activity-B', worker_b_id, semester_id FROM st_ownership_ids;

INSERT INTO public.schedule_teachers (weekday, activity, worker_id, semester_id)
SELECT 'Miercoles', 'QA-Activity-Null', NULL, semester_id FROM st_ownership_ids;

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000001';
SELECT (SELECT count(*) FROM public.schedule_teachers WHERE semester_id = :'semester_id'::bigint) AS admin_visible_count \gset
SELECT (SELECT count(*) FROM public.schedule_teachers WHERE semester_id = :'semester_id'::bigint AND worker_id IS NULL) AS admin_sees_null_owned \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'admin_visible_count'::bigint, 3::bigint, 'admin sees every schedule_teachers row');
SELECT is(:'admin_sees_null_owned'::bigint, 1::bigint, 'admin sees the worker-less schedule_teachers row');

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000002';
SELECT (SELECT count(*) FROM public.schedule_teachers WHERE semester_id = :'semester_id'::bigint) AS staff_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'staff_visible_count'::bigint, 3::bigint, 'staff sees every schedule_teachers row');

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000003';
SELECT (SELECT count(*) FROM public.schedule_teachers) AS worker_a_visible_count \gset
SELECT (SELECT count(*) FROM public.schedule_teachers WHERE activity = 'QA-Activity-B') AS worker_a_sees_worker_b \gset
SELECT (SELECT count(*) FROM public.schedule_teachers WHERE worker_id IS NULL) AS worker_a_sees_null_owned \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'worker_a_visible_count'::bigint, 1::bigint, 'worker A sees exactly one schedule_teachers row');
SELECT is(:'worker_a_sees_worker_b'::bigint, 0::bigint, 'worker A cannot see worker B schedule_teachers rows');
SELECT is(:'worker_a_sees_null_owned'::bigint, 0::bigint, 'worker A cannot see worker-less schedule_teachers rows');

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000004';
SELECT (SELECT count(*) FROM public.schedule_teachers) AS worker_b_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'worker_b_visible_count'::bigint, 1::bigint, 'worker B sees exactly one schedule_teachers row');

SELECT ok(
    NOT has_table_privilege('anon', 'public.schedule_teachers', 'SELECT')
    AND NOT has_table_privilege('anon', 'public.schedule_teachers', 'INSERT')
    AND NOT has_table_privilege('anon', 'public.schedule_teachers', 'UPDATE')
    AND NOT has_table_privilege('anon', 'public.schedule_teachers', 'DELETE'),
    'anon has no schedule_teachers DML privileges'
);

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000005';
SELECT (SELECT count(*) FROM public.schedule_teachers WHERE semester_id = :'semester_id'::bigint) AS noprofile_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'noprofile_visible_count'::bigint, 0::bigint, 'an authenticated session with no profile sees no schedule_teachers rows');

SELECT throws_ok(
    $$INSERT INTO public.profiles (id, role, worker_id) VALUES ('e2000000-0000-0000-0000-000000000009', 'manager', NULL)$$,
    '23514',
    NULL,
    'profiles rejects an unrecognized role value'
);

SELECT throws_ok(
    $$INSERT INTO public.profiles (id, role, worker_id) VALUES ('e2000000-0000-0000-0000-000000000009', 'worker', NULL)$$,
    '23514',
    NULL,
    'profiles rejects a worker role with no worker_id'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'schedule_teachers'
          AND policyname = 'Enable read access for all users'
    ),
    'legacy unrestricted schedule_teachers SELECT policy is absent'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'schedule_teachers'
          AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
    ),
    'schedule_teachers has no public or anon policies'
);

SELECT is(
    (SELECT count(*)::int FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'schedule_teachers'
       AND cmd = 'SELECT'
       AND roles = ARRAY['authenticated']::name[]),
    2,
    'schedule_teachers has exactly two authenticated SELECT policies'
);

SELECT is(
    (SELECT count(*)::int FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'schedule_teachers'
       AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
       AND roles = ARRAY['authenticated']::name[]),
    3,
    'schedule_teachers has exactly three authenticated write policies'
);

SELECT is(
    (SELECT count(*)::int FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'schedule_teachers'
       AND policyname IN (
           'Staff and admin create schedule teacher activities',
           'Staff and admin update schedule teacher activities',
           'Staff and admin delete schedule teacher activities'
       )),
    3,
    'schedule_teachers has the expected staff/admin write policies'
);

SELECT ok(
    has_table_privilege('authenticated', 'public.schedule_teachers', 'SELECT')
    AND has_table_privilege('authenticated', 'public.schedule_teachers', 'INSERT')
    AND has_table_privilege('authenticated', 'public.schedule_teachers', 'UPDATE')
    AND has_table_privilege('authenticated', 'public.schedule_teachers', 'DELETE'),
    'authenticated retains the DML grants needed for RLS-controlled access'
);

SELECT ok(
    NOT has_sequence_privilege('anon', 'public.schedule_teachers_id_seq', 'USAGE')
    AND NOT has_sequence_privilege('anon', 'public.schedule_teachers_id_seq', 'SELECT'),
    'anon has no schedule_teachers identity-sequence privileges'
);

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000003';

SELECT throws_ok(
    format(
        $$INSERT INTO public.schedule_teachers (weekday, activity, worker_id, semester_id) VALUES ('Jueves', 'QA-Worker-Insert', %L, %L)$$,
        :'worker_a_id',
        :'semester_id'
    ),
    '42501',
    NULL,
    'worker cannot insert schedule_teachers rows'
);

WITH updated AS (
    UPDATE public.schedule_teachers
    SET activity = 'QA-Worker-Updated'
    WHERE activity = 'QA-Activity-A'
    RETURNING 1
)
SELECT count(*) AS worker_update_count FROM updated \gset

WITH deleted AS (
    DELETE FROM public.schedule_teachers
    WHERE activity = 'QA-Activity-A'
    RETURNING 1
)
SELECT count(*) AS worker_delete_count FROM deleted \gset

RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'worker_update_count'::bigint, 0::bigint, 'worker cannot update schedule_teachers rows');
SELECT is(:'worker_delete_count'::bigint, 0::bigint, 'worker cannot delete schedule_teachers rows');

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e2000000-0000-0000-0000-000000000002';

WITH inserted AS (
    INSERT INTO public.schedule_teachers (weekday, activity, worker_id, semester_id)
    VALUES ('Jueves', 'QA-Staff-Insert', :'worker_a_id'::bigint, :'semester_id'::bigint)
    RETURNING 1
)
SELECT count(*) AS staff_insert_count FROM inserted \gset

WITH updated AS (
    UPDATE public.schedule_teachers
    SET activity = 'QA-Staff-Updated'
    WHERE activity = 'QA-Staff-Insert'
    RETURNING 1
)
SELECT count(*) AS staff_update_count FROM updated \gset

WITH deleted AS (
    DELETE FROM public.schedule_teachers
    WHERE activity = 'QA-Staff-Updated'
    RETURNING 1
)
SELECT count(*) AS staff_delete_count FROM deleted \gset

RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'staff_insert_count'::bigint, 1::bigint, 'staff can insert schedule_teachers rows');
SELECT is(:'staff_update_count'::bigint, 1::bigint, 'staff can update schedule_teachers rows');
SELECT is(:'staff_delete_count'::bigint, 1::bigint, 'staff can delete schedule_teachers rows');

SELECT * FROM finish();

ROLLBACK;
