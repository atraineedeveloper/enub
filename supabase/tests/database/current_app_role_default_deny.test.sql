BEGIN;

SET search_path = public, extensions;

-- Regression coverage for decisions.md #7: a session with no profiles row
-- must resolve to NULL ("no recognized role"), never to 'staff' (the
-- original, since-corrected default) and never to any other truthy value
-- that could be mistaken for access. This is the exact invariant whose
-- violation (a NULL-unsafe `<> 'admin'` check) was found and fixed during
-- implementation -- see database-plan.md §3's "Bug found during
-- implementation" note.

SELECT plan(5);

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'default-deny-real-user@example.test', 'x', now(), '{}', '{}', now(), now());

-- A real auth.users row with no profiles row at all (e.g. a worker account
-- just created in Studio but not yet run through link_worker_account).
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0000000-0000-0000-0000-000000000001';
SELECT (public.current_app_role() IS NULL) AS real_user_role_is_null \gset
SELECT (public.current_worker_id() IS NULL) AS real_user_worker_id_is_null \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT ok(:'real_user_role_is_null'::boolean, 'current_app_role() is NULL for a real auth.users row with no profiles row');
SELECT ok(:'real_user_worker_id_is_null'::boolean, 'current_worker_id() is NULL for a real auth.users row with no profiles row');

-- A uuid that doesn't correspond to any auth.users row at all (defensive:
-- the functions must not error, just return NULL).
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
SELECT (public.current_app_role() IS NULL) AS phantom_user_role_is_null \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT ok(:'phantom_user_role_is_null'::boolean, 'current_app_role() is NULL (not an error) for a uuid with no auth.users row at all');

-- No JWT claim set at all (e.g. anon-equivalent call context): still NULL,
-- not an error and not 'staff'.
SET LOCAL role authenticated;
RESET "request.jwt.claim.sub";
SELECT (public.current_app_role() IS NULL) AS no_claim_role_is_null \gset
RESET role;

SELECT ok(:'no_claim_role_is_null'::boolean, 'current_app_role() is NULL when no JWT sub claim is set at all');

-- Sanity: once linked, the same account resolves to a real, non-NULL role
-- -- confirms the NULL result above is specifically about the missing
-- profiles row, not some unrelated breakage in the helper functions.
CREATE TEMP TABLE default_deny_worker AS
WITH worker_insert AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Default Deny Worker', 'QA', 1)
    RETURNING id
)
SELECT worker_insert.id AS worker_id FROM worker_insert;

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'f0000000-0000-0000-0000-000000000001', 'worker', worker_id FROM default_deny_worker;

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f0000000-0000-0000-0000-000000000001';
SELECT (public.current_app_role() = 'worker') AS linked_role_is_worker \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT ok(:'linked_role_is_worker'::boolean, 'current_app_role() resolves to a real role once a profiles row exists');

SELECT * FROM finish();

ROLLBACK;
