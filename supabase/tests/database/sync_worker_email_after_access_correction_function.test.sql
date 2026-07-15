-- Coverage for sync_worker_email_after_access_correction (design.md §9,
-- tasks.md §5): bound only to operation_id, sharing the claim RPC's fixed
-- lock order, with an immutable (never re-read) optimistic guard.

BEGIN;

SET search_path = public, extensions;

SELECT plan(15);

-- Grant/ownership rigor -----------------------------------------------

SELECT ok(
    (
        SELECT prosecdef
        FROM pg_proc
        WHERE proname = 'sync_worker_email_after_access_correction' AND pronamespace = 'public'::regnamespace
    ),
    'sync_worker_email_after_access_correction is SECURITY DEFINER'
);

SELECT is(
    (
        SELECT pg_get_userbyid(proowner)
        FROM pg_proc
        WHERE proname = 'sync_worker_email_after_access_correction' AND pronamespace = 'public'::regnamespace
    ),
    'postgres'::name,
    'sync_worker_email_after_access_correction is owned by postgres'
);

SELECT ok(
    (
        SELECT proconfig @> ARRAY['search_path=""']
        FROM pg_proc
        WHERE proname = 'sync_worker_email_after_access_correction' AND pronamespace = 'public'::regnamespace
    ),
    'sync_worker_email_after_access_correction has a fixed, empty search_path'
);

SELECT ok(
    NOT has_function_privilege('anon', 'public.sync_worker_email_after_access_correction(bigint)', 'EXECUTE'),
    'anon cannot execute sync_worker_email_after_access_correction'
);

SELECT ok(
    NOT has_function_privilege('authenticated', 'public.sync_worker_email_after_access_correction(bigint)', 'EXECUTE'),
    'authenticated cannot execute sync_worker_email_after_access_correction'
);

SELECT ok(
    has_function_privilege('service_role', 'public.sync_worker_email_after_access_correction(bigint)', 'EXECUTE'),
    'service_role can execute sync_worker_email_after_access_correction'
);

-- updated ----------------------------------------------------------------

WITH w AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('SWAEC Updated Worker', 'QA', 1, 'swaec-updated-old@example.test') RETURNING id
)
SELECT id AS updated_worker_id FROM w \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '74000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'swaec-updated-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('74000000-0000-0000-0000-000000000001', 'worker', :updated_worker_id);

SELECT operation_id AS updated_op_id FROM public.claim_worker_access_email_correction(:updated_worker_id, 'swaec-updated-target@example.test') \gset

SELECT is(
    public.sync_worker_email_after_access_correction(:updated_op_id),
    'updated'::text,
    'updated on a clean call'
);

SELECT is(
    (SELECT email::text FROM public.workers WHERE id = :updated_worker_id),
    'swaec-updated-target@example.test'::text,
    'workers.email actually reflects the new target after updated'
);

SELECT is(
    public.sync_worker_email_after_access_correction(:updated_op_id),
    'already_current'::text,
    'already_current when called again after the row already matches'
);

-- stale_worker_edit (immutable guard catches a concurrent edit) ----------

WITH w AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('SWAEC Stale Worker', 'QA', 1, 'swaec-stale-old@example.test') RETURNING id
)
SELECT id AS stale_worker_id FROM w \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '74000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'swaec-stale-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('74000000-0000-0000-0000-000000000002', 'worker', :stale_worker_id);

SELECT operation_id AS stale_op_id FROM public.claim_worker_access_email_correction(:stale_worker_id, 'swaec-stale-target@example.test') \gset

-- Simulate a concurrent ordinary worker edit between claim time and sync time.
UPDATE public.workers SET email = 'swaec-stale-concurrent@example.test' WHERE id = :stale_worker_id;

SELECT is(
    public.sync_worker_email_after_access_correction(:stale_op_id),
    'stale_worker_edit'::text,
    'stale_worker_edit when the immutable guard no longer matches the current raw email'
);

SELECT is(
    (SELECT email::text FROM public.workers WHERE id = :stale_worker_id),
    'swaec-stale-concurrent@example.test'::text,
    'the concurrent edit was not overwritten'
);

-- duplicate_worker_email (detected inside this transaction) --------------

WITH w_owner AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('SWAEC Dup Owner', 'QA', 1, 'swaec-dup-owner@example.test') RETURNING id
),
w_claimant AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('SWAEC Dup Claimant', 'QA', 1, 'swaec-dup-claimant@example.test') RETURNING id
)
SELECT w_owner.id AS dup_owner_id, w_claimant.id AS dup_claimant_id FROM w_owner, w_claimant \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '74000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'swaec-dup-claimant-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('74000000-0000-0000-0000-000000000003', 'worker', :dup_claimant_id);

SELECT operation_id AS dup_op_id FROM public.claim_worker_access_email_correction(:dup_claimant_id, 'swaec-dup-claimant-target@example.test') \gset

-- Another worker acquires the exact target email only AFTER the claim was made.
UPDATE public.workers SET email = 'swaec-dup-claimant-target@example.test' WHERE id = :dup_owner_id;

SELECT is(
    public.sync_worker_email_after_access_correction(:dup_op_id),
    'duplicate_worker_email'::text,
    'duplicate_worker_email when another worker acquires the target email before synchronization'
);

-- linkage_changed ----------------------------------------------------------

WITH w_link AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('SWAEC Linkage Worker', 'QA', 1, 'swaec-linkage-old@example.test') RETURNING id
)
SELECT id AS linkage_worker_id FROM w_link \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', '74000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'swaec-linkage-auth@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '74000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'swaec-linkage-newauth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('74000000-0000-0000-0000-000000000004', 'worker', :linkage_worker_id);

SELECT operation_id AS linkage_op_id FROM public.claim_worker_access_email_correction(:linkage_worker_id, 'swaec-linkage-target@example.test') \gset

-- Simulate an unrelated relink (e.g. unlink_worker_account + link_worker_account)
-- changing which Auth user this worker's profile points to.
DELETE FROM public.profiles WHERE worker_id = :linkage_worker_id;
INSERT INTO public.profiles (id, role, worker_id) VALUES ('74000000-0000-0000-0000-000000000005', 'worker', :linkage_worker_id);

SELECT is(
    public.sync_worker_email_after_access_correction(:linkage_op_id),
    'linkage_changed'::text,
    'linkage_changed when the profile now points at a different Auth user than the operation recorded'
);

-- operation_not_active -----------------------------------------------------

WITH w_done AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('SWAEC Done Worker', 'QA', 1, 'swaec-done-old@example.test') RETURNING id
)
SELECT id AS done_worker_id FROM w_done \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '74000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'swaec-done-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('74000000-0000-0000-0000-000000000006', 'worker', :done_worker_id);

SELECT operation_id AS done_op_id FROM public.claim_worker_access_email_correction(:done_worker_id, 'swaec-done-target@example.test') \gset

UPDATE public.worker_access_email_corrections SET state = 'manual_attention_required' WHERE id = :done_op_id;

SELECT is(
    public.sync_worker_email_after_access_correction(:done_op_id),
    'operation_not_active'::text,
    'operation_not_active when the operation is not active'
);

-- operation_identity_mismatch (the recorded Auth user vanishes) ----------

WITH w_mismatch AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('SWAEC Mismatch Worker', 'QA', 1, 'swaec-mismatch-old@example.test') RETURNING id
)
SELECT id AS mismatch_worker_id FROM w_mismatch \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '74000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'swaec-mismatch-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('74000000-0000-0000-0000-000000000007', 'worker', :mismatch_worker_id);

SELECT operation_id AS mismatch_op_id FROM public.claim_worker_access_email_correction(:mismatch_worker_id, 'swaec-mismatch-target@example.test') \gset

-- Drop the FK just as the claim test does, to construct the otherwise-
-- unreachable "operation's own recorded Auth user has vanished" fixture.
ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
DELETE FROM auth.users WHERE id = '74000000-0000-0000-0000-000000000007';

SELECT is(
    public.sync_worker_email_after_access_correction(:mismatch_op_id),
    'operation_identity_mismatch'::text,
    'operation_identity_mismatch when the operation''s own recorded Auth user no longer exists'
);

SELECT * FROM finish();

ROLLBACK;
