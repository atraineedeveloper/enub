BEGIN;

SET search_path = public, extensions;

SELECT plan(9);

SELECT ok(
    (
        SELECT prosecdef
        FROM pg_proc
        WHERE proname = 'grant_staff_role' AND pronamespace = 'public'::regnamespace
    ),
    'grant_staff_role is SECURITY DEFINER'
);

CREATE TEMP TABLE gsr_ids AS
WITH worker_insert AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Grant Staff Role Worker', 'QA', 1)
    RETURNING id
)
SELECT worker_insert.id AS worker_id FROM worker_insert;

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gsr-admin@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'gsr-noaccess@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'gsr-worker@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'gsr-brand-new@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'gsr-existing-staff@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id) VALUES ('30000000-0000-0000-0000-000000000001', 'admin', NULL);
INSERT INTO public.profiles (id, role, worker_id) VALUES ('30000000-0000-0000-0000-000000000005', 'staff', NULL);
INSERT INTO public.profiles (id, role, worker_id) SELECT '30000000-0000-0000-0000-000000000003', 'worker', worker_id FROM gsr_ids;
-- 30000000-...-002 (no-access) and ...-004 (brand new) get no profiles row.

-- Regression: a caller with no profiles row must be rejected.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000002';
SELECT throws_ok(
    $$SELECT public.grant_staff_role('gsr-brand-new@example.test')$$,
    'P0001',
    'Only admins can grant staff role',
    'a caller with no profiles row is rejected'
);
RESET role;
RESET "request.jwt.claim.sub";

-- A worker (non-admin) caller is rejected too.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000003';
SELECT throws_ok(
    $$SELECT public.grant_staff_role('gsr-brand-new@example.test')$$,
    'P0001',
    'Only admins can grant staff role',
    'a worker (non-admin) caller is rejected'
);
RESET role;
RESET "request.jwt.claim.sub";

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SELECT throws_ok(
    $$SELECT public.grant_staff_role('does-not-exist@example.test')$$,
    'P0001',
    'No auth account found for does-not-exist@example.test',
    'admin caller granting staff to a nonexistent email is rejected'
);
RESET role;
RESET "request.jwt.claim.sub";

-- Rejects converting an already-linked worker account.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SELECT throws_ok(
    $$SELECT public.grant_staff_role('gsr-worker@example.test')$$,
    'P0001',
    'This account is linked to a worker; call unlink_worker_account first if converting it to staff is intentional',
    'granting staff role to an already-linked worker account is rejected'
);
RESET role;
RESET "request.jwt.claim.sub";

-- Happy path: brand-new account with no profiles row at all gets staff.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SELECT lives_ok(
    $$SELECT public.grant_staff_role('gsr-brand-new@example.test')$$,
    'admin can grant staff role to a brand-new account'
);
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(
    (SELECT role FROM public.profiles WHERE id = '30000000-0000-0000-0000-000000000004'),
    'staff'::text,
    'the brand-new account now has role=staff'
);

SELECT ok(
    (SELECT worker_id FROM public.profiles WHERE id = '30000000-0000-0000-0000-000000000004') IS NULL,
    'the brand-new account has worker_id=NULL'
);

-- Re-affirming an existing staff account is a safe no-op (unlike
-- link_worker_account's stricter collision handling -- see
-- database-plan.md §5's reasoning).
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '30000000-0000-0000-0000-000000000001';
SELECT lives_ok(
    $$SELECT public.grant_staff_role('gsr-existing-staff@example.test')$$,
    'granting staff role to an already-staff account is a safe no-op'
);
RESET role;
RESET "request.jwt.claim.sub";

SELECT * FROM finish();

ROLLBACK;
