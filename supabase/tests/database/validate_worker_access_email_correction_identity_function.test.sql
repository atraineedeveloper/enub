-- Coverage for validate_worker_access_email_correction_identity
-- (code-review finding #1, add-worker-access-email-correction): a
-- server-only, read-only linkage/identity revalidation gate the Edge
-- Function calls immediately before every updateUserById attempt.
--
-- `operation_identity_mismatch` (a linkage change detected ONLY under the
-- full two-lock guarantee, not already caught by the earlier worker-lock-
-- only check) is, by construction, a narrow race-window condition only a
-- genuinely concurrent second session can trigger -- it is intentionally
-- NOT covered here; every other one of the six result values is
-- deterministically reachable and is tested below.

BEGIN;

SET search_path = public, extensions;

SELECT plan(13);

-- Grant/ownership rigor -----------------------------------------------

SELECT ok(
    (
        SELECT prosecdef
        FROM pg_proc
        WHERE proname = 'validate_worker_access_email_correction_identity' AND pronamespace = 'public'::regnamespace
    ),
    'validate_worker_access_email_correction_identity is SECURITY DEFINER'
);

SELECT is(
    (
        SELECT pg_get_userbyid(proowner)
        FROM pg_proc
        WHERE proname = 'validate_worker_access_email_correction_identity' AND pronamespace = 'public'::regnamespace
    ),
    'postgres'::name,
    'validate_worker_access_email_correction_identity is owned by postgres'
);

SELECT ok(
    (
        SELECT proconfig @> ARRAY['search_path=""']
        FROM pg_proc
        WHERE proname = 'validate_worker_access_email_correction_identity' AND pronamespace = 'public'::regnamespace
    ),
    'validate_worker_access_email_correction_identity has a fixed, empty search_path'
);

SELECT ok(
    NOT has_function_privilege('anon', 'public.validate_worker_access_email_correction_identity(bigint)', 'EXECUTE'),
    'anon cannot execute validate_worker_access_email_correction_identity'
);

SELECT ok(
    NOT has_function_privilege('authenticated', 'public.validate_worker_access_email_correction_identity(bigint)', 'EXECUTE'),
    'authenticated cannot execute validate_worker_access_email_correction_identity'
);

SELECT ok(
    has_function_privilege('service_role', 'public.validate_worker_access_email_correction_identity(bigint)', 'EXECUTE'),
    'service_role can execute validate_worker_access_email_correction_identity'
);

-- valid --------------------------------------------------------------

WITH w AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('VWAECI Valid Worker', 'QA', 1, 'vwaeci-valid@example.test') RETURNING id
)
SELECT id AS valid_worker_id FROM w \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'vwaeci-valid-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('80000000-0000-0000-0000-000000000001', 'worker', :valid_worker_id);

SELECT operation_id AS valid_op_id FROM public.claim_worker_access_email_correction(:valid_worker_id, 'vwaeci-valid-target@example.test') \gset

SELECT is(
    public.validate_worker_access_email_correction_identity(:valid_op_id),
    'valid'::text,
    'valid when nothing has changed since the claim'
);

-- operation_not_active -------------------------------------------------

WITH w AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('VWAECI Inactive Worker', 'QA', 1, 'vwaeci-inactive@example.test') RETURNING id
)
SELECT id AS inactive_worker_id FROM w \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'vwaeci-inactive-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('80000000-0000-0000-0000-000000000002', 'worker', :inactive_worker_id);

SELECT operation_id AS inactive_op_id FROM public.claim_worker_access_email_correction(:inactive_worker_id, 'vwaeci-inactive-target@example.test') \gset

UPDATE public.worker_access_email_corrections SET state = 'completed' WHERE id = :inactive_op_id;

SELECT is(
    public.validate_worker_access_email_correction_identity(:inactive_op_id),
    'operation_not_active'::text,
    'operation_not_active for a completed operation'
);

-- worker_not_found -------------------------------------------------------
-- workers.id is referenced with ON DELETE RESTRICT by this table, so a
-- worker with a blocking operation cannot normally be deleted -- the FK is
-- dropped here, scoped to this rolled-back transaction, purely to
-- construct the otherwise-unreachable fixture (same technique already
-- used elsewhere in this test suite for linked_auth_user_missing).

WITH w AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('VWAECI Deleted Worker', 'QA', 1, 'vwaeci-deleted@example.test') RETURNING id
)
SELECT id AS deleted_worker_id FROM w \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'vwaeci-deleted-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('80000000-0000-0000-0000-000000000003', 'worker', :deleted_worker_id);

SELECT operation_id AS deleted_op_id FROM public.claim_worker_access_email_correction(:deleted_worker_id, 'vwaeci-deleted-target@example.test') \gset

ALTER TABLE public.worker_access_email_corrections DROP CONSTRAINT worker_access_email_corrections_worker_id_fkey;
DELETE FROM public.profiles WHERE worker_id = :deleted_worker_id;
DELETE FROM public.workers WHERE id = :deleted_worker_id;

SELECT is(
    public.validate_worker_access_email_correction_identity(:deleted_op_id),
    'worker_not_found'::text,
    'worker_not_found when the worker itself no longer exists'
);

-- linkage_changed (profile relinked to a different Auth user) -----------

WITH w AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('VWAECI Relinked Worker', 'QA', 1, 'vwaeci-relinked@example.test') RETURNING id
)
SELECT id AS relinked_worker_id FROM w \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'vwaeci-relinked-old-auth@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'vwaeci-relinked-new-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('80000000-0000-0000-0000-000000000004', 'worker', :relinked_worker_id);

SELECT operation_id AS relinked_op_id FROM public.claim_worker_access_email_correction(:relinked_worker_id, 'vwaeci-relinked-target@example.test') \gset

-- Simulate an unrelated relink (unlink_worker_account + link_worker_account)
-- happening after the claim but before the Edge Function's Auth mutation.
DELETE FROM public.profiles WHERE worker_id = :relinked_worker_id;
INSERT INTO public.profiles (id, role, worker_id) VALUES ('80000000-0000-0000-0000-000000000005', 'worker', :relinked_worker_id);

SELECT is(
    public.validate_worker_access_email_correction_identity(:relinked_op_id),
    'linkage_changed'::text,
    'linkage_changed when the profile now points at a different Auth user than the operation recorded'
);

-- linkage_changed (profile unlinked entirely) ----------------------------

WITH w AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('VWAECI Unlinked Worker', 'QA', 1, 'vwaeci-unlinked@example.test') RETURNING id
)
SELECT id AS unlinked_worker_id FROM w \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'vwaeci-unlinked-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('80000000-0000-0000-0000-000000000006', 'worker', :unlinked_worker_id);

SELECT operation_id AS unlinked_op_id FROM public.claim_worker_access_email_correction(:unlinked_worker_id, 'vwaeci-unlinked-target@example.test') \gset

DELETE FROM public.profiles WHERE worker_id = :unlinked_worker_id;

SELECT is(
    public.validate_worker_access_email_correction_identity(:unlinked_op_id),
    'linkage_changed'::text,
    'linkage_changed when the profile has been unlinked entirely'
);

-- linked_auth_user_missing (the recorded Auth row itself vanishes) -------

WITH w AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('VWAECI Vanished Auth Worker', 'QA', 1, 'vwaeci-vanished@example.test') RETURNING id
)
SELECT id AS vanished_worker_id FROM w \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '80000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'vwaeci-vanished-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('80000000-0000-0000-0000-000000000007', 'worker', :vanished_worker_id);

SELECT operation_id AS vanished_op_id FROM public.claim_worker_access_email_correction(:vanished_worker_id, 'vwaeci-vanished-target@example.test') \gset

-- Drop the FK just as elsewhere in this suite, to construct the
-- otherwise-unreachable "the operation's own recorded Auth user has
-- vanished, while linkage itself still matches" fixture.
ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
DELETE FROM auth.users WHERE id = '80000000-0000-0000-0000-000000000007';

SELECT is(
    public.validate_worker_access_email_correction_identity(:vanished_op_id),
    'linked_auth_user_missing'::text,
    'linked_auth_user_missing when the operation''s own recorded Auth user no longer exists but linkage itself is unchanged'
);

-- Raises for a missing/invalid operation id ------------------------------

SELECT throws_ok(
    $$SELECT public.validate_worker_access_email_correction_identity(999999999)$$,
    'WAEC2',
    NULL,
    'raises for a nonexistent operation id'
);

SELECT * FROM finish();

ROLLBACK;
