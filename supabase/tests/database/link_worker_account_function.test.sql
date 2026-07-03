BEGIN;

SET search_path = public, extensions;

SELECT plan(11);

SELECT ok(
    (
        SELECT prosecdef
        FROM pg_proc
        WHERE proname = 'link_worker_account' AND pronamespace = 'public'::regnamespace
    ),
    'link_worker_account is SECURITY DEFINER'
);

CREATE TEMP TABLE lwa_ids AS
WITH worker_c AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Link Worker C', 'QA', 1)
    RETURNING id
),
worker_d AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Link Worker D', 'QA', 1)
    RETURNING id
)
SELECT worker_c.id AS worker_c_id, worker_d.id AS worker_d_id FROM worker_c, worker_d;

SELECT worker_c_id, worker_d_id FROM lwa_ids \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'lwa-admin@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'lwa-staff@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'lwa-noaccess@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'lwa-worker-b@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'lwa-fresh-a@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'lwa-fresh-b@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id) VALUES ('10000000-0000-0000-0000-000000000001', 'admin', NULL);
INSERT INTO public.profiles (id, role, worker_id) VALUES ('10000000-0000-0000-0000-000000000002', 'staff', NULL);
INSERT INTO public.profiles (id, role, worker_id) SELECT '10000000-0000-0000-0000-000000000004', 'worker', worker_d_id FROM lwa_ids;
-- 10000000-...-003 (no-access), ...-005 and ...-006 (fresh) get no profiles row.

-- Regression test for the exact bug found during implementation: a caller
-- with NO profiles row must be rejected, not silently let through by a
-- NULL-unsafe `<> 'admin'` check. See decisions.md #7 and
-- database-plan.md §3.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000003';
SELECT throws_ok(
    $$SELECT public.link_worker_account(1, 'lwa-fresh-a@example.test')$$,
    'P0001',
    'Only admins can link worker accounts',
    'a caller with no profiles row is rejected, not silently admitted'
);
RESET role;
RESET "request.jwt.claim.sub";

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000002';
SELECT throws_ok(
    $$SELECT public.link_worker_account(1, 'lwa-fresh-a@example.test')$$,
    'P0001',
    'Only admins can link worker accounts',
    'a staff (non-admin) caller is rejected'
);
RESET role;
RESET "request.jwt.claim.sub";

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
SELECT throws_ok(
    $$SELECT public.link_worker_account(1, 'does-not-exist@example.test')$$,
    'P0001',
    'No auth account found for does-not-exist@example.test',
    'admin caller linking a nonexistent email is rejected'
);
RESET role;
RESET "request.jwt.claim.sub";

-- Happy path: admin links a fresh (unlinked) auth account to a fresh
-- (unlinked) worker.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
SELECT lives_ok(
    format($$SELECT public.link_worker_account(%L, 'lwa-fresh-a@example.test')$$, :'worker_c_id'),
    'admin can link a fresh account to a fresh worker'
);
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(
    (SELECT role FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000005'),
    'worker'::text,
    'the resulting profile row has role=worker'
);

SELECT is(
    (SELECT worker_id FROM public.profiles WHERE id = '10000000-0000-0000-0000-000000000005'),
    (SELECT worker_c_id FROM lwa_ids),
    'the resulting profile row has the correct worker_id'
);

-- Collision: the same worker_id already has a different linked account.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
SELECT throws_ok(
    format($$SELECT public.link_worker_account(%L, 'lwa-fresh-b@example.test')$$, :'worker_c_id'),
    'P0001',
    format('Worker %s already has a linked account; unlink it first', :'worker_c_id'),
    'linking a worker_id that already has a linked account is rejected'
);
RESET role;
RESET "request.jwt.claim.sub";

-- Collision: re-linking an already-linked worker account to a different worker.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
SELECT throws_ok(
    format($$SELECT public.link_worker_account(%L, 'lwa-worker-b@example.test')$$, :'worker_d_id'),
    'P0001',
    'This account is already linked to a different worker; call unlink_worker_account first',
    're-linking an already-linked worker account is rejected'
);
RESET role;
RESET "request.jwt.claim.sub";

-- Collision: target account already has role admin.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
SELECT throws_ok(
    format($$SELECT public.link_worker_account(%L, 'lwa-admin@example.test')$$, :'worker_d_id'),
    'P0001',
    'This account already has role admin and cannot be linked as a worker; revoke that role first if this is intentional',
    'linking an account that already has role admin is rejected'
);
RESET role;
RESET "request.jwt.claim.sub";

-- Collision: target account already has role staff.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
SELECT throws_ok(
    format($$SELECT public.link_worker_account(%L, 'lwa-staff@example.test')$$, :'worker_d_id'),
    'P0001',
    'This account already has role staff and cannot be linked as a worker; revoke that role first if this is intentional',
    'linking an account that already has role staff is rejected'
);
RESET role;
RESET "request.jwt.claim.sub";

SELECT * FROM finish();

ROLLBACK;
