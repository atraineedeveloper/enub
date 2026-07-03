BEGIN;

SET search_path = public, extensions;

-- Regression coverage for decisions.md #12: public.workers previously had
-- "FOR SELECT USING (true)" and "FOR UPDATE USING (true) WITH CHECK (true)"
-- with no TO clause -- meaning anon could read and update every worker row.
-- worker-self-service-documents tightened both to TO authenticated plus an
-- explicit role check.

SELECT plan(10);

SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'workers'
            AND cmd = 'SELECT'
            AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
    ),
    'anon no longer has a SELECT policy on workers'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'workers'
            AND cmd = 'UPDATE'
            AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
    ),
    'anon no longer has an UPDATE policy on workers'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'workers'
            AND policyname = 'Staff and admin can read all workers'
            AND cmd = 'SELECT'
            AND 'authenticated' = ANY(roles)
    ),
    'staff/admin SELECT policy exists for authenticated'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'workers'
            AND policyname = 'Workers can read own worker row'
            AND cmd = 'SELECT'
            AND 'authenticated' = ANY(roles)
    ),
    'worker-ownership SELECT policy exists for authenticated'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'workers'
            AND policyname = 'Staff and admin can update workers'
            AND cmd = 'UPDATE'
            AND 'authenticated' = ANY(roles)
    ),
    'staff/admin UPDATE policy exists for authenticated'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'workers' AND cmd = 'UPDATE' AND policyname LIKE '%worker%row%'
    ),
    'workers has no worker-ownership UPDATE policy (workers cannot edit their own row via this feature)'
);

-- Behavioral: staff sees all workers, a worker sees only its own row, and a
-- no-role session sees none.
CREATE TEMP TABLE workers_rls_ids AS
WITH worker_a AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Workers RLS Worker A', 'QA', 1)
    RETURNING id
),
worker_b AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Workers RLS Worker B', 'QA', 1)
    RETURNING id
)
SELECT worker_a.id AS worker_a_id, worker_b.id AS worker_b_id
FROM worker_a, worker_b;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'workers-rls-staff@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'workers-rls-worker-a@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'workers-rls-noaccess@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id)
VALUES ('c0000000-0000-0000-0000-000000000001', 'staff', NULL);

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'c0000000-0000-0000-0000-000000000002', 'worker', worker_a_id FROM workers_rls_ids;

-- c0000000-...-003 gets no profiles row at all: default-deny.

SELECT (SELECT count(*) FROM public.workers) AS total_worker_count \gset

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000001';
SELECT (SELECT count(*) FROM public.workers) AS staff_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'staff_visible_count'::bigint, :'total_worker_count'::bigint, 'a staff session sees every worker row');

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000002';
SELECT (SELECT count(*) FROM public.workers) AS worker_visible_count \gset
SELECT (SELECT id FROM public.workers LIMIT 1) AS worker_visible_id \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'worker_visible_count'::bigint, 1::bigint, 'a worker session sees exactly one worker row');
SELECT is(
    :'worker_visible_id'::bigint,
    (SELECT worker_a_id FROM workers_rls_ids),
    'the one worker row a worker session sees is its own'
);

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'c0000000-0000-0000-0000-000000000003';
SELECT (SELECT count(*) FROM public.workers) AS noaccess_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'noaccess_visible_count'::bigint, 0::bigint, 'a session with no profiles row sees no workers');

SELECT * FROM finish();

ROLLBACK;
