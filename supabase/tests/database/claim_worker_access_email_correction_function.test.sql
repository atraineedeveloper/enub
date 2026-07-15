-- Coverage for claim_worker_access_email_correction (design.md §6,
-- tasks.md §3): trusted inputs, pre-claim validation, and non-destructive
-- ambiguity reconciliation (never an impossible insert).

BEGIN;

SET search_path = public, extensions;

SELECT plan(32);

-- Grant/ownership rigor -----------------------------------------------

SELECT ok(
    (
        SELECT prosecdef
        FROM pg_proc
        WHERE proname = 'claim_worker_access_email_correction' AND pronamespace = 'public'::regnamespace
    ),
    'claim_worker_access_email_correction is SECURITY DEFINER'
);

SELECT is(
    (
        SELECT pg_get_userbyid(proowner)
        FROM pg_proc
        WHERE proname = 'claim_worker_access_email_correction' AND pronamespace = 'public'::regnamespace
    ),
    'postgres'::name,
    'claim_worker_access_email_correction is owned by postgres'
);

SELECT ok(
    (
        SELECT proconfig @> ARRAY['search_path=""']
        FROM pg_proc
        WHERE proname = 'claim_worker_access_email_correction' AND pronamespace = 'public'::regnamespace
    ),
    'claim_worker_access_email_correction has a fixed, empty search_path'
);

SELECT ok(
    NOT has_function_privilege('anon', 'public.claim_worker_access_email_correction(bigint, text)', 'EXECUTE'),
    'anon cannot execute claim_worker_access_email_correction'
);

SELECT ok(
    NOT has_function_privilege('authenticated', 'public.claim_worker_access_email_correction(bigint, text)', 'EXECUTE'),
    'authenticated cannot execute claim_worker_access_email_correction'
);

SELECT ok(
    has_function_privilege('service_role', 'public.claim_worker_access_email_correction(bigint, text)', 'EXECUTE'),
    'service_role can execute claim_worker_access_email_correction'
);

-- Fixtures ------------------------------------------------------------

WITH w_fresh AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('CWAEC Fresh Worker', 'QA', 1, 'cwaec-fresh@example.test') RETURNING id
),
w_synced AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('CWAEC Synced Worker', 'QA', 1, 'cwaec-synced-target@example.test') RETURNING id
),
w_dup_other AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('CWAEC Dup Other', 'QA', 1, 'cwaec-dup-target@example.test') RETURNING id
),
w_dup_target AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('CWAEC Dup Target', 'QA', 1, 'cwaec-dup-worker@example.test') RETURNING id
),
w_missing_auth AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('CWAEC Missing Auth', 'QA', 1, 'cwaec-missing-auth@example.test') RETURNING id
),
w_notfound_check AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('CWAEC NotFound Helper', 'QA', 1, 'cwaec-notfound-helper@example.test') RETURNING id
),
w_resume AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('CWAEC Resume Worker', 'QA', 1, 'cwaec-resume-worker@example.test') RETURNING id
),
w_conflict AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('CWAEC Conflict Worker', 'QA', 1, 'cwaec-conflict-worker@example.test') RETURNING id
),
w_manual AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('CWAEC Manual Worker', 'QA', 1, 'cwaec-manual-worker@example.test') RETURNING id
),
w_ambig_a AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('CWAEC Ambig A', 'QA', 1, 'cwaec-ambig-a@example.test') RETURNING id
),
w_ambig_b AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('CWAEC Ambig B', 'QA', 1, 'cwaec-ambig-b@example.test') RETURNING id
),
w_two_rows_a AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('CWAEC Two Rows A', 'QA', 1, 'cwaec-tworows-a@example.test') RETURNING id
),
w_two_rows_b AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('CWAEC Two Rows B', 'QA', 1, 'cwaec-tworows-b@example.test') RETURNING id
)
SELECT
    w_fresh.id AS fresh_id,
    w_synced.id AS synced_id,
    w_dup_other.id AS dup_other_id,
    w_dup_target.id AS dup_target_id,
    w_missing_auth.id AS missing_auth_id,
    w_notfound_check.id AS notfound_helper_id,
    w_resume.id AS resume_id,
    w_conflict.id AS conflict_id,
    w_manual.id AS manual_id,
    w_ambig_a.id AS ambig_a_id,
    w_ambig_b.id AS ambig_b_id,
    w_two_rows_a.id AS two_rows_a_id,
    w_two_rows_b.id AS two_rows_b_id
FROM w_fresh, w_synced, w_dup_other, w_dup_target, w_missing_auth, w_notfound_check, w_resume,
     w_conflict, w_manual, w_ambig_a, w_ambig_b, w_two_rows_a, w_two_rows_b
\gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', '72000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'cwaec-fresh-auth@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '72000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'cwaec-synced-target@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '72000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'cwaec-dup-target-auth@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '72000000-0000-0000-0000-000000000012', 'authenticated', 'authenticated', 'cwaec-dup-other-auth@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '72000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'cwaec-resume-auth@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '72000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'cwaec-conflict-auth@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '72000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'cwaec-manual-auth@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '72000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'cwaec-ambig-a-auth@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '72000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'cwaec-ambig-b-auth@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '72000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated', 'cwaec-tworows-a-auth@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '72000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'cwaec-tworows-b-auth@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id) VALUES ('72000000-0000-0000-0000-000000000001', 'worker', :fresh_id);
INSERT INTO public.profiles (id, role, worker_id) VALUES ('72000000-0000-0000-0000-000000000002', 'worker', :synced_id);
INSERT INTO public.profiles (id, role, worker_id) VALUES ('72000000-0000-0000-0000-000000000003', 'worker', :dup_target_id);
INSERT INTO public.profiles (id, role, worker_id) VALUES ('72000000-0000-0000-0000-000000000012', 'worker', :dup_other_id);
INSERT INTO public.profiles (id, role, worker_id) VALUES ('72000000-0000-0000-0000-000000000005', 'worker', :resume_id);
INSERT INTO public.profiles (id, role, worker_id) VALUES ('72000000-0000-0000-0000-000000000006', 'worker', :conflict_id);
INSERT INTO public.profiles (id, role, worker_id) VALUES ('72000000-0000-0000-0000-000000000007', 'worker', :manual_id);
INSERT INTO public.profiles (id, role, worker_id) VALUES ('72000000-0000-0000-0000-000000000008', 'worker', :ambig_a_id);
INSERT INTO public.profiles (id, role, worker_id) VALUES ('72000000-0000-0000-0000-000000000009', 'worker', :ambig_b_id);
INSERT INTO public.profiles (id, role, worker_id) VALUES ('72000000-0000-0000-0000-000000000010', 'worker', :two_rows_a_id);
INSERT INTO public.profiles (id, role, worker_id) VALUES ('72000000-0000-0000-0000-000000000011', 'worker', :two_rows_b_id);
-- missing_auth_id, notfound_helper_id get no profile / no auth user, per case.

-- worker_not_found ------------------------------------------------------

SELECT is(
    (SELECT outcome FROM public.claim_worker_access_email_correction(999999999, 'nobody@example.test')),
    'worker_not_found'::text,
    'worker_not_found for a nonexistent worker id'
);

-- worker_not_linked -------------------------------------------------------

WITH w_unlinked AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('CWAEC Unlinked', 'QA', 1, 'cwaec-unlinked@example.test') RETURNING id
)
SELECT id AS unlinked_id FROM w_unlinked \gset

SELECT is(
    (SELECT outcome FROM public.claim_worker_access_email_correction(:unlinked_id, 'somewhere@example.test')),
    'worker_not_linked'::text,
    'worker_not_linked for a worker with no linked profile'
);

-- linked_auth_user_missing (verified before creating any claim) ----------

-- profiles.id normally has a FK to auth.users(id) ON DELETE CASCADE, which
-- would make an orphaned profile impossible to construct directly (either
-- the insert fails, or deleting the auth.users row cascades and deletes
-- the profile too). Dropped here, inside this rolled-back test transaction
-- only, purely to construct the otherwise-unreachable "profile references
-- a since-vanished Auth user" fixture this function must still defend
-- against.
ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;

INSERT INTO public.profiles (id, role, worker_id) VALUES ('72000000-0000-0000-0000-000000000004', 'worker', :missing_auth_id);
-- Deliberately no matching auth.users row for ...004.

SELECT is(
    (SELECT outcome FROM public.claim_worker_access_email_correction(:missing_auth_id, 'somewhere-else@example.test')),
    'linked_auth_user_missing'::text,
    'linked_auth_user_missing when the linked profile references no real Auth user'
);

SELECT is(
    (SELECT count(*) FROM public.worker_access_email_corrections WHERE worker_id = :missing_auth_id)::int,
    0,
    'no operation row created for linked_auth_user_missing'
);

-- duplicate_worker_email (pre-claim, before any operation is created) ----

SELECT is(
    (SELECT outcome FROM public.claim_worker_access_email_correction(:dup_other_id, 'cwaec-dup-worker@example.test')),
    'duplicate_worker_email'::text,
    'duplicate_worker_email when another worker already owns the canonical target'
);

SELECT is(
    (SELECT count(*) FROM public.worker_access_email_corrections WHERE worker_id = :dup_other_id)::int,
    0,
    'no operation row created for the pre-claim duplicate_worker_email rejection'
);

-- created ------------------------------------------------------------------

SELECT is(
    (SELECT outcome FROM public.claim_worker_access_email_correction(:fresh_id, 'cwaec-new-target@example.test')),
    'created'::text,
    'created on a clean first call'
);

-- already_completed (both sides already match at claim time) ------------

SELECT is(
    (SELECT outcome FROM public.claim_worker_access_email_correction(:synced_id, 'cwaec-synced-target@example.test')),
    'already_completed'::text,
    'already_completed when Auth and worker already both match the requested target'
);

SELECT is(
    (SELECT state FROM public.worker_access_email_corrections WHERE worker_id = :synced_id),
    'completed'::text,
    'the already_completed row is inserted directly as completed'
);

-- resumed --------------------------------------------------------------

SELECT public.claim_worker_access_email_correction(:resume_id, 'cwaec-resume-target@example.test');

SELECT is(
    (SELECT outcome FROM public.claim_worker_access_email_correction(:resume_id, 'cwaec-resume-target@example.test')),
    'resumed'::text,
    'resumed when an identical target is claimed again while the first is still active'
);

SELECT is(
    (SELECT count(*) FROM public.worker_access_email_corrections WHERE worker_id = :resume_id)::int,
    1,
    'exactly one row exists after a resumed claim'
);

-- different_target_in_progress ------------------------------------------

SELECT public.claim_worker_access_email_correction(:conflict_id, 'cwaec-conflict-target-one@example.test');

SELECT is(
    (SELECT outcome FROM public.claim_worker_access_email_correction(:conflict_id, 'cwaec-conflict-target-two@example.test')),
    'different_target_in_progress'::text,
    'different_target_in_progress when a different target is requested while active'
);

SELECT is(
    (SELECT requested_canonical_email FROM public.worker_access_email_corrections WHERE worker_id = :conflict_id),
    'cwaec-conflict-target-one@example.test'::text,
    'the original active row''s target is unchanged'
);

SELECT is(
    (SELECT count(*) FROM public.worker_access_email_corrections WHERE worker_id = :conflict_id)::int,
    1,
    'no second row was created for the different-target conflict'
);

-- manual_attention_blocking -----------------------------------------------

-- A data-modifying CTE and its dependent statement share one per-statement
-- snapshot in PostgreSQL, so a side-effecting function call inside a plain
-- (non-data-modifying) CTE is NOT visible to a sibling UPDATE in the very
-- same statement -- the claim and the state-forcing UPDATE below must be
-- two separate statements, capturing operation_id via \gset in between.
SELECT operation_id AS manual_op_id FROM public.claim_worker_access_email_correction(:manual_id, 'cwaec-manual-target@example.test') \gset

UPDATE public.worker_access_email_corrections
SET state = 'manual_attention_required', last_reason_code = 'ambiguous_claim_state'
WHERE id = :manual_op_id;

SELECT is(
    (SELECT outcome FROM public.claim_worker_access_email_correction(:manual_id, 'cwaec-any-other-target@example.test')),
    'manual_attention_blocking'::text,
    'manual_attention_blocking regardless of the newly requested target'
);

SELECT is(
    (SELECT count(*) FROM public.worker_access_email_corrections WHERE worker_id = :manual_id)::int,
    1,
    'no second row is created for manual_attention_blocking'
);

-- ambiguous_claim_state: one row implicated with inconsistent linkage ----

SELECT operation_id AS ambig_op_id FROM public.claim_worker_access_email_correction(:ambig_a_id, 'cwaec-ambig-target@example.test') \gset

UPDATE public.worker_access_email_corrections
SET linked_auth_user_id = '72000000-0000-0000-0000-000000000009'
WHERE id = :ambig_op_id;

SELECT is(
    (SELECT outcome FROM public.claim_worker_access_email_correction(:ambig_a_id, 'cwaec-ambig-target@example.test')),
    'ambiguous_claim_state'::text,
    'ambiguous_claim_state when the existing row''s recorded linkage disagrees with a fresh resolution'
);

SELECT is(
    (SELECT state FROM public.worker_access_email_corrections WHERE worker_id = :ambig_a_id),
    'manual_attention_required'::text,
    'the existing implicated row is transitioned to manual_attention_required in place, not duplicated'
);

SELECT is(
    (SELECT count(*) FROM public.worker_access_email_corrections WHERE worker_id = :ambig_a_id)::int,
    1,
    'still exactly one row for the worker after the in-place transition'
);

-- ambiguous_claim_state: two distinct blocking rows ------------------------

WITH claimed_a AS (
    SELECT operation_id FROM public.claim_worker_access_email_correction(:two_rows_a_id, 'cwaec-two-rows-target-a@example.test')
)
SELECT operation_id AS two_rows_op_a FROM claimed_a \gset

WITH claimed_b AS (
    SELECT operation_id FROM public.claim_worker_access_email_correction(:two_rows_b_id, 'cwaec-two-rows-target-b@example.test')
)
SELECT operation_id AS two_rows_op_b FROM claimed_b \gset

-- Construct two distinct blocking rows reachable one way each: first move
-- row A's own stored linked_auth_user_id away (simulating it having
-- already drifted from the fresh resolution -- otherwise the partial
-- unique index would forbid two simultaneously-active rows sharing the
-- same linked_auth_user_id), then point row B's stored linked_auth_user_id
-- at worker A's real, freshly-resolved linked Auth user id. Two separate
-- statements so the index is never violated at either individual step.
UPDATE public.worker_access_email_corrections
SET linked_auth_user_id = '72000000-0000-0000-0000-000000099999'
WHERE id = :two_rows_op_a;

UPDATE public.worker_access_email_corrections
SET linked_auth_user_id = '72000000-0000-0000-0000-000000000010'
WHERE id = :two_rows_op_b;

SELECT is(
    (SELECT outcome FROM public.claim_worker_access_email_correction(:two_rows_a_id, 'cwaec-two-rows-target-a@example.test')),
    'ambiguous_claim_state'::text,
    'ambiguous_claim_state when independent searches find two distinct blocking rows'
);

SELECT is(
    (SELECT state FROM public.worker_access_email_corrections WHERE id = :two_rows_op_a),
    'active'::text,
    'row A is left untouched when two distinct blocking rows are found'
);

SELECT is(
    (SELECT state FROM public.worker_access_email_corrections WHERE id = :two_rows_op_b),
    'active'::text,
    'row B is left untouched when two distinct blocking rows are found'
);

-- Finding: explicit NULL/empty/whitespace/malformed rejection ------------
-- The worker id used below is deliberately nonexistent -- step 1's
-- canonicalization/validation check must raise before ever touching the
-- workers table, so no real fixture is needed for these four cases.

SELECT throws_ok(
    $$SELECT * FROM public.claim_worker_access_email_correction(999999999, NULL)$$,
    'WAEC1',
    NULL,
    'a SQL NULL requested_email raises WAEC1 (invalid_email), rather than silently bypassing validation and later failing on an unclassified constraint violation'
);

SELECT throws_ok(
    $$SELECT * FROM public.claim_worker_access_email_correction(999999999, '')$$,
    'WAEC1',
    NULL,
    'an empty-string requested_email raises WAEC1'
);

SELECT throws_ok(
    $$SELECT * FROM public.claim_worker_access_email_correction(999999999, '   ')$$,
    'WAEC1',
    NULL,
    'a whitespace-only requested_email raises WAEC1'
);

SELECT throws_ok(
    $$SELECT * FROM public.claim_worker_access_email_correction(999999999, 'not-an-email')$$,
    'WAEC1',
    NULL,
    'a malformed requested_email raises WAEC1'
);

SELECT * FROM finish();

ROLLBACK;
