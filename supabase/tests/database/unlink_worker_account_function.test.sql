BEGIN;

SET search_path = public, extensions;

SELECT plan(7);

SELECT ok(
    (
        SELECT prosecdef
        FROM pg_proc
        WHERE proname = 'unlink_worker_account' AND pronamespace = 'public'::regnamespace
    ),
    'unlink_worker_account is SECURITY DEFINER'
);

CREATE TEMP TABLE uwa_ids AS
WITH worker_insert AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Unlink Worker', 'QA', 1)
    RETURNING id
)
SELECT worker_insert.id AS worker_id FROM worker_insert;

SELECT worker_id FROM uwa_ids \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'uwa-admin@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'uwa-staff@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'uwa-noaccess@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'uwa-worker@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id) VALUES ('20000000-0000-0000-0000-000000000001', 'admin', NULL);
INSERT INTO public.profiles (id, role, worker_id) VALUES ('20000000-0000-0000-0000-000000000002', 'staff', NULL);
INSERT INTO public.profiles (id, role, worker_id) SELECT '20000000-0000-0000-0000-000000000004', 'worker', worker_id FROM uwa_ids;
-- 20000000-...-003 (no-access) gets no profiles row.

-- Regression: a caller with no profiles row must be rejected, same NULL-
-- safety concern as link_worker_account. See decisions.md #7.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000003';
SELECT throws_ok(
    format($$SELECT public.unlink_worker_account(%L)$$, :'worker_id'),
    'P0001',
    'Only admins can unlink worker accounts',
    'a caller with no profiles row is rejected'
);
RESET role;
RESET "request.jwt.claim.sub";

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
SELECT throws_ok(
    format($$SELECT public.unlink_worker_account(%L)$$, :'worker_id'),
    'P0001',
    'Only admins can unlink worker accounts',
    'a staff (non-admin) caller is rejected'
);
RESET role;
RESET "request.jwt.claim.sub";

-- Unlinking a worker_id with no existing link is a safe no-op.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SELECT lives_ok(
    $$SELECT public.unlink_worker_account(999999999)$$,
    'unlinking a worker_id with no existing link is a safe no-op'
);
RESET role;
RESET "request.jwt.claim.sub";

-- Happy path: admin unlinks the worker.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000001';
SELECT lives_ok(
    format($$SELECT public.unlink_worker_account(%L)$$, :'worker_id'),
    'admin can unlink a linked worker account'
);
RESET role;
RESET "request.jwt.claim.sub";

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '20000000-0000-0000-0000-000000000004'),
    'the profiles row is gone after unlinking'
);

-- Critical: after unlinking, the account has NO role at all -- it must NOT
-- fall back to staff. This is the exact regression this feature's security
-- review targeted. See decisions.md #19.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000004';
SELECT (public.current_app_role() IS NULL) AS role_after_unlink_is_null \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT ok(:'role_after_unlink_is_null'::boolean, 'the account has no role at all after unlinking -- not staff');

SELECT * FROM finish();

ROLLBACK;
