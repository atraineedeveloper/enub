BEGIN;

SET search_path = public, extensions;

SELECT plan(10);

SELECT ok(
    (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass),
    'RLS is enabled on profiles'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'profiles'
            AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
    ),
    'anon has no policy at all on profiles'
);

-- Only the SECURITY DEFINER RPCs (link_worker_account, unlink_worker_account,
-- grant_staff_role) write to profiles; there must be no INSERT/UPDATE/DELETE
-- policy granting that directly to authenticated. See decisions.md #12.
SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'INSERT'
    ),
    'profiles has no INSERT policy for any role'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'UPDATE'
    ),
    'profiles has no UPDATE policy for any role'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'DELETE'
    ),
    'profiles has no DELETE policy for any role'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'profiles'
            AND policyname = 'Users can read own profile'
            AND cmd = 'SELECT'
            AND 'authenticated' = ANY(roles)
    ),
    '"Users can read own profile" SELECT policy exists for authenticated'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'profiles'
            AND policyname = 'Admins can read all profiles'
            AND cmd = 'SELECT'
            AND 'authenticated' = ANY(roles)
    ),
    '"Admins can read all profiles" SELECT policy exists for authenticated'
);

-- Behavioral: a plain authenticated session cannot write to profiles even
-- though the table has a broad GRANT (matching the worker_documents/workers
-- pattern) -- RLS denies it because no policy grants INSERT.
CREATE TEMP TABLE profiles_rls_ids AS
WITH worker_a AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Profiles RLS Worker A', 'QA', 1)
    RETURNING id
),
worker_b AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Profiles RLS Worker B', 'QA', 1)
    RETURNING id
)
SELECT worker_a.id AS worker_a_id, worker_b.id AS worker_b_id
FROM worker_a, worker_b;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'profiles-rls-admin@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'profiles-rls-worker-a@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'profiles-rls-worker-b@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id)
VALUES ('b0000000-0000-0000-0000-000000000001', 'admin', NULL);

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'b0000000-0000-0000-0000-000000000002', 'worker', worker_a_id FROM profiles_rls_ids;

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'b0000000-0000-0000-0000-000000000003', 'worker', worker_b_id FROM profiles_rls_ids;

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'b0000000-0000-0000-0000-000000000002';
SELECT (SELECT count(*) FROM public.profiles) AS worker_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'worker_visible_count'::bigint, 1::bigint, 'a worker session can read exactly its own profile row, not others');

-- Total row count as seen by a role that bypasses RLS (the current
-- session), used as the "everything" baseline. Not hardcoded, because the
-- local seed data already includes one bootstrap admin profile (see
-- supabase/seed.sql) in addition to the three rows this test creates.
SELECT (SELECT count(*) FROM public.profiles) AS total_profile_count \gset

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'b0000000-0000-0000-0000-000000000001';
SELECT (SELECT count(*) FROM public.profiles) AS admin_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'admin_visible_count'::bigint, :'total_profile_count'::bigint, 'an admin session can read all profiles rows');

-- Capture the outcome of a direct INSERT attempt from a plain authenticated
-- session (via a DO block, so the exception is caught locally rather than
-- aborting the whole test transaction), then RESET role before making any
-- pgTAP assertion -- pgTAP's own bookkeeping runs as the connecting role,
-- not as "authenticated".
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'b0000000-0000-0000-0000-000000000002';
DO $$
BEGIN
    BEGIN
        INSERT INTO public.profiles (id, role, worker_id)
        VALUES ('b0000000-0000-0000-0000-000000000099', 'admin', NULL);
        PERFORM set_config('profiles_rls_test.insert_rejected', 'false', true);
    EXCEPTION WHEN insufficient_privilege THEN
        PERFORM set_config('profiles_rls_test.insert_rejected', 'true', true);
    END;
END;
$$;
SELECT current_setting('profiles_rls_test.insert_rejected') AS insert_rejected \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT ok(
    :'insert_rejected'::boolean,
    'a plain authenticated session cannot directly INSERT into profiles (no policy grants it)'
);

SELECT * FROM finish();

ROLLBACK;
