-- Coverage for mark_worker_access_email_correction_completed and
-- mark_worker_access_email_correction_manual_attention (design.md §9,
-- tasks.md §6): shared locking/linkage protocol, narrow manual-attention
-- reason set, and independent re-verification (never trusting a
-- caller-asserted "it worked").

BEGIN;

SET search_path = public, extensions;

SELECT plan(31);

-- Grant/ownership rigor, both functions ---------------------------------

SELECT ok(
    (SELECT prosecdef FROM pg_proc WHERE proname = 'mark_worker_access_email_correction_completed' AND pronamespace = 'public'::regnamespace),
    'mark_worker_access_email_correction_completed is SECURITY DEFINER'
);

SELECT is(
    (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE proname = 'mark_worker_access_email_correction_completed' AND pronamespace = 'public'::regnamespace),
    'postgres'::name,
    'mark_worker_access_email_correction_completed is owned by postgres'
);

SELECT ok(
    (SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE proname = 'mark_worker_access_email_correction_completed' AND pronamespace = 'public'::regnamespace),
    'mark_worker_access_email_correction_completed has a fixed, empty search_path'
);

SELECT ok(
    NOT has_function_privilege('authenticated', 'public.mark_worker_access_email_correction_completed(bigint)', 'EXECUTE'),
    'authenticated cannot execute mark_worker_access_email_correction_completed'
);

SELECT ok(
    has_function_privilege('service_role', 'public.mark_worker_access_email_correction_completed(bigint)', 'EXECUTE'),
    'service_role can execute mark_worker_access_email_correction_completed'
);

SELECT ok(
    (SELECT prosecdef FROM pg_proc WHERE proname = 'mark_worker_access_email_correction_manual_attention' AND pronamespace = 'public'::regnamespace),
    'mark_worker_access_email_correction_manual_attention is SECURITY DEFINER'
);

SELECT is(
    (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE proname = 'mark_worker_access_email_correction_manual_attention' AND pronamespace = 'public'::regnamespace),
    'postgres'::name,
    'mark_worker_access_email_correction_manual_attention is owned by postgres'
);

SELECT ok(
    (SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE proname = 'mark_worker_access_email_correction_manual_attention' AND pronamespace = 'public'::regnamespace),
    'mark_worker_access_email_correction_manual_attention has a fixed, empty search_path'
);

SELECT ok(
    NOT has_function_privilege('authenticated', 'public.mark_worker_access_email_correction_manual_attention(bigint, text)', 'EXECUTE'),
    'authenticated cannot execute mark_worker_access_email_correction_manual_attention'
);

SELECT ok(
    has_function_privilege('service_role', 'public.mark_worker_access_email_correction_manual_attention(bigint, text)', 'EXECUTE'),
    'service_role can execute mark_worker_access_email_correction_manual_attention'
);

-- mark_..._completed: true + transitions when both sides genuinely match --

WITH w AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('MWAEC Completed Worker', 'QA', 1, 'mwaec-completed@example.test') RETURNING id
)
SELECT id AS completed_worker_id FROM w \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '75000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'mwaec-completed-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('75000000-0000-0000-0000-000000000001', 'worker', :completed_worker_id);

SELECT operation_id AS completed_op_id FROM public.claim_worker_access_email_correction(:completed_worker_id, 'mwaec-completed-target@example.test') \gset

-- Bring both sides to the target directly (simulating the Auth update and
-- worker sync already having happened).
UPDATE auth.users SET email = 'mwaec-completed-target@example.test' WHERE id = '75000000-0000-0000-0000-000000000001';
UPDATE public.workers SET email = 'mwaec-completed-target@example.test' WHERE id = :completed_worker_id;

SELECT is(
    public.mark_worker_access_email_correction_completed(:completed_op_id),
    true,
    'mark_..._completed returns true when both sides genuinely converge'
);

SELECT is(
    (SELECT state FROM public.worker_access_email_corrections WHERE id = :completed_op_id),
    'completed'::text,
    'the operation is actually transitioned to completed'
);

-- mark_..._completed: false, no transition, when NOT converged -----------

WITH w2 AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('MWAEC Not Converged Worker', 'QA', 1, 'mwaec-notconverged@example.test') RETURNING id
)
SELECT id AS notconverged_worker_id FROM w2 \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '75000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'mwaec-notconverged-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('75000000-0000-0000-0000-000000000002', 'worker', :notconverged_worker_id);

SELECT operation_id AS notconverged_op_id FROM public.claim_worker_access_email_correction(:notconverged_worker_id, 'mwaec-notconverged-target@example.test') \gset

-- Deliberately do NOT bring either side to the target -- call the
-- completion transition anyway (as if the Edge Function's own belief were
-- wrong) and confirm the RPC's own independent re-check refuses it.
SELECT is(
    public.mark_worker_access_email_correction_completed(:notconverged_op_id),
    false,
    'mark_..._completed returns false when the sides do not actually converge, even if called anyway'
);

SELECT is(
    (SELECT state FROM public.worker_access_email_corrections WHERE id = :notconverged_op_id),
    'active'::text,
    'the operation is NOT transitioned when convergence is not genuinely confirmed'
);

-- Both transition RPCs reject a non-active operation ----------------------

UPDATE public.worker_access_email_corrections SET state = 'completed' WHERE id = :notconverged_op_id;

SELECT is(
    public.mark_worker_access_email_correction_completed(:notconverged_op_id),
    false,
    'mark_..._completed refuses a non-active (already completed) operation'
);

-- mark_..._manual_attention: accepts linkage_changed when the claimed
-- mismatch is genuinely observed --------------------------------------
-- Finding #7 hardening: this reason is only accepted when a fresh re-read
-- under both locks actually shows the profile's linked Auth user no
-- longer matches the operation's recorded identity -- the fixture below
-- relinks the profile after the claim, exactly as the analogous test in
-- the claim RPC's own suite does, so the claimed condition is real.

WITH w3 AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('MWAEC Manual Worker', 'QA', 1, 'mwaec-manual@example.test') RETURNING id
)
SELECT id AS manual_worker_id FROM w3 \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', '75000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'mwaec-manual-auth@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '75000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 'mwaec-manual-relinked-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('75000000-0000-0000-0000-000000000003', 'worker', :manual_worker_id);

SELECT operation_id AS manual_op_id FROM public.claim_worker_access_email_correction(:manual_worker_id, 'mwaec-manual-target@example.test') \gset

DELETE FROM public.profiles WHERE worker_id = :manual_worker_id;
INSERT INTO public.profiles (id, role, worker_id) VALUES ('75000000-0000-0000-0000-000000000103', 'worker', :manual_worker_id);

SELECT lives_ok(
    format($$SELECT public.mark_worker_access_email_correction_manual_attention(%L, 'linkage_changed')$$, :manual_op_id),
    'mark_..._manual_attention accepts linkage_changed when a genuine mismatch is freshly observed'
);

SELECT is(
    (SELECT state FROM public.worker_access_email_corrections WHERE id = :manual_op_id),
    'manual_attention_required'::text,
    'the operation is transitioned to manual_attention_required'
);

SELECT is(
    (SELECT last_reason_code FROM public.worker_access_email_corrections WHERE id = :manual_op_id),
    'linkage_changed'::text,
    'the specific reason is recorded'
);

-- mark_..._manual_attention: rejects a FALSE linkage_changed claim -------
-- (finding #7: never pretend linkage still matches, and never accept a
-- claimed condition this RPC can directly disprove).

WITH w3b AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('MWAEC False Linkage Worker', 'QA', 1, 'mwaec-falselinkage@example.test') RETURNING id
)
SELECT id AS falselinkage_worker_id FROM w3b \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '75000000-0000-0000-0000-000000000104', 'authenticated', 'authenticated', 'mwaec-falselinkage-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('75000000-0000-0000-0000-000000000104', 'worker', :falselinkage_worker_id);

SELECT operation_id AS falselinkage_op_id FROM public.claim_worker_access_email_correction(:falselinkage_worker_id, 'mwaec-falselinkage-target@example.test') \gset

-- Linkage is deliberately left untouched -- the claimed reason is false.
SELECT throws_ok(
    format($$SELECT public.mark_worker_access_email_correction_manual_attention(%L, 'linkage_changed')$$, :falselinkage_op_id),
    'WAEC9',
    NULL,
    'mark_..._manual_attention rejects a linkage_changed claim when linkage genuinely still matches'
);

SELECT is(
    (SELECT state FROM public.worker_access_email_corrections WHERE id = :falselinkage_op_id),
    'active'::text,
    'the operation is not transitioned when the claimed reason is disproven'
);

-- mark_..._manual_attention: rejects a FALSE operation_identity_mismatch
-- claim -------------------------------------------------------------

WITH w3c AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('MWAEC False Mismatch Worker', 'QA', 1, 'mwaec-falsemismatch@example.test') RETURNING id
)
SELECT id AS falsemismatch_worker_id FROM w3c \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '75000000-0000-0000-0000-000000000105', 'authenticated', 'authenticated', 'mwaec-falsemismatch-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('75000000-0000-0000-0000-000000000105', 'worker', :falsemismatch_worker_id);

SELECT operation_id AS falsemismatch_op_id FROM public.claim_worker_access_email_correction(:falsemismatch_worker_id, 'mwaec-falsemismatch-target@example.test') \gset

SELECT throws_ok(
    format($$SELECT public.mark_worker_access_email_correction_manual_attention(%L, 'operation_identity_mismatch')$$, :falsemismatch_op_id),
    'WAEC9',
    NULL,
    'mark_..._manual_attention rejects an operation_identity_mismatch claim when the recorded identity is still fully consistent'
);

SELECT is(
    (SELECT state FROM public.worker_access_email_corrections WHERE id = :falsemismatch_op_id),
    'active'::text,
    'the operation is not transitioned when the claimed reason is disproven'
);

-- mark_..._manual_attention: external_auth_email_changed (finding #2) ----

WITH w3d AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('MWAEC External Drift Worker', 'QA', 1, 'mwaec-extdrift@example.test') RETURNING id
)
SELECT id AS extdrift_worker_id FROM w3d \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '75000000-0000-0000-0000-000000000106', 'authenticated', 'authenticated', 'mwaec-extdrift-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('75000000-0000-0000-0000-000000000106', 'worker', :extdrift_worker_id);

SELECT operation_id AS extdrift_op_id FROM public.claim_worker_access_email_correction(:extdrift_worker_id, 'mwaec-extdrift-target@example.test') \gset

-- An external actor changes Auth to an unrelated third email.
UPDATE auth.users SET email = 'mwaec-extdrift-unrelated@example.test' WHERE id = '75000000-0000-0000-0000-000000000106';

SELECT lives_ok(
    format($$SELECT public.mark_worker_access_email_correction_manual_attention(%L, 'external_auth_email_changed')$$, :extdrift_op_id),
    'mark_..._manual_attention accepts external_auth_email_changed when Auth genuinely differs from the requested target'
);

SELECT is(
    (SELECT state FROM public.worker_access_email_corrections WHERE id = :extdrift_op_id),
    'manual_attention_required'::text,
    'the operation is transitioned to manual_attention_required'
);

SELECT is(
    (SELECT last_reason_code FROM public.worker_access_email_corrections WHERE id = :extdrift_op_id),
    'external_auth_email_changed'::text,
    'the specific reason is recorded'
);

-- mark_..._manual_attention: rejects a FALSE external_auth_email_changed
-- claim (Auth already equals the requested target) ----------------------

WITH w3e AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('MWAEC False Drift Worker', 'QA', 1, 'mwaec-falsedrift@example.test') RETURNING id
)
SELECT id AS falsedrift_worker_id FROM w3e \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '75000000-0000-0000-0000-000000000107', 'authenticated', 'authenticated', 'mwaec-falsedrift-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('75000000-0000-0000-0000-000000000107', 'worker', :falsedrift_worker_id);

SELECT operation_id AS falsedrift_op_id FROM public.claim_worker_access_email_correction(:falsedrift_worker_id, 'mwaec-falsedrift-target@example.test') \gset

UPDATE auth.users SET email = 'mwaec-falsedrift-target@example.test' WHERE id = '75000000-0000-0000-0000-000000000107';

SELECT throws_ok(
    format($$SELECT public.mark_worker_access_email_correction_manual_attention(%L, 'external_auth_email_changed')$$, :falsedrift_op_id),
    'WAEC9',
    NULL,
    'mark_..._manual_attention rejects external_auth_email_changed when Auth already equals the requested target'
);

SELECT is(
    (SELECT state FROM public.worker_access_email_corrections WHERE id = :falsedrift_op_id),
    'active'::text,
    'the operation is not transitioned when the claimed reason is disproven'
);

-- mark_..._manual_attention: rejects linked_auth_user_missing ------------
-- (not one of this transition's own seven narrow reasons, even though it
-- is a valid result value of validate_worker_access_email_correction_identity).

WITH w3f AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('MWAEC Unrecognized Reason Worker', 'QA', 1, 'mwaec-unrecognized@example.test') RETURNING id
)
SELECT id AS unrecognized_worker_id FROM w3f \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '75000000-0000-0000-0000-000000000108', 'authenticated', 'authenticated', 'mwaec-unrecognized-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('75000000-0000-0000-0000-000000000108', 'worker', :unrecognized_worker_id);

SELECT operation_id AS unrecognized_op_id FROM public.claim_worker_access_email_correction(:unrecognized_worker_id, 'mwaec-unrecognized-target@example.test') \gset

SELECT throws_ok(
    format($$SELECT public.mark_worker_access_email_correction_manual_attention(%L, 'linked_auth_user_missing')$$, :unrecognized_op_id),
    'WAEC3',
    NULL,
    'mark_..._manual_attention rejects linked_auth_user_missing -- not one of its own seven narrow reasons'
);

-- mark_..._manual_attention: rejects an unrelated reason code -------------

WITH w4 AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('MWAEC Bad Reason Worker', 'QA', 1, 'mwaec-badreason@example.test') RETURNING id
)
SELECT id AS badreason_worker_id FROM w4 \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '75000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'mwaec-badreason-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('75000000-0000-0000-0000-000000000004', 'worker', :badreason_worker_id);

SELECT operation_id AS badreason_op_id FROM public.claim_worker_access_email_correction(:badreason_worker_id, 'mwaec-badreason-target@example.test') \gset

-- 'already_synchronized' is a generally-valid last_reason_code value (for
-- completed rows) but is NOT one of the six reasons this specific
-- transition accepts.
SELECT throws_ok(
    format($$SELECT public.mark_worker_access_email_correction_manual_attention(%L, 'already_synchronized')$$, :badreason_op_id),
    'WAEC3',
    NULL,
    'mark_..._manual_attention rejects a reason code outside its own narrow set, even one otherwise valid for last_reason_code'
);

SELECT is(
    (SELECT state FROM public.worker_access_email_corrections WHERE id = :badreason_op_id),
    'active'::text,
    'the operation is not transitioned when the reason code is rejected'
);

-- No other function/grant permits a direct mutation -----------------------

SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = 'worker_access_email_corrections'
          AND grantee = 'authenticated' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
    ),
    'authenticated has no direct INSERT/UPDATE/DELETE grant on worker_access_email_corrections'
);

SELECT * FROM finish();

ROLLBACK;
