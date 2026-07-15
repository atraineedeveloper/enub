-- Coverage for get_worker_access_email_correction_auth_email (code-review
-- finding #9, add-worker-access-email-correction): an operation-bound raw
-- Auth email read, replacing the general-purpose UUID lookup for the
-- correction flow's own reads.

BEGIN;

SET search_path = public, extensions;

SELECT plan(10);

-- Grant/ownership rigor -----------------------------------------------

SELECT ok(
    (
        SELECT prosecdef
        FROM pg_proc
        WHERE proname = 'get_worker_access_email_correction_auth_email' AND pronamespace = 'public'::regnamespace
    ),
    'get_worker_access_email_correction_auth_email is SECURITY DEFINER'
);

SELECT is(
    (
        SELECT pg_get_userbyid(proowner)
        FROM pg_proc
        WHERE proname = 'get_worker_access_email_correction_auth_email' AND pronamespace = 'public'::regnamespace
    ),
    'postgres'::name,
    'get_worker_access_email_correction_auth_email is owned by postgres'
);

SELECT ok(
    (
        SELECT proconfig @> ARRAY['search_path=""']
        FROM pg_proc
        WHERE proname = 'get_worker_access_email_correction_auth_email' AND pronamespace = 'public'::regnamespace
    ),
    'get_worker_access_email_correction_auth_email has a fixed, empty search_path'
);

SELECT ok(
    NOT has_function_privilege('anon', 'public.get_worker_access_email_correction_auth_email(bigint)', 'EXECUTE'),
    'anon cannot execute get_worker_access_email_correction_auth_email'
);

SELECT ok(
    NOT has_function_privilege('authenticated', 'public.get_worker_access_email_correction_auth_email(bigint)', 'EXECUTE'),
    'authenticated cannot execute get_worker_access_email_correction_auth_email'
);

SELECT ok(
    has_function_privilege('service_role', 'public.get_worker_access_email_correction_auth_email(bigint)', 'EXECUTE'),
    'service_role can execute get_worker_access_email_correction_auth_email'
);

-- Behavior ---------------------------------------------------------------

WITH w AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('GWAECAE Worker', 'QA', 1, 'gwaecae-worker@example.test') RETURNING id
)
SELECT id AS worker_id FROM w \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gwaecae-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('81000000-0000-0000-0000-000000000001', 'worker', :worker_id);

SELECT operation_id AS op_id FROM public.claim_worker_access_email_correction(:worker_id, 'gwaecae-target@example.test') \gset

SELECT is(
    public.get_worker_access_email_correction_auth_email(:op_id),
    'gwaecae-auth@example.test'::text,
    'returns the linked Auth user''s current raw email for a valid, active operation'
);

SELECT throws_ok(
    $$SELECT public.get_worker_access_email_correction_auth_email(999999999)$$,
    'WAEC2',
    NULL,
    'raises for a nonexistent operation id'
);

-- operation_not_active (a manual_attention_required operation is still
-- "blocking" and therefore still readable -- only a completed one is not).

UPDATE public.worker_access_email_corrections SET state = 'manual_attention_required' WHERE id = :op_id;

SELECT is(
    public.get_worker_access_email_correction_auth_email(:op_id),
    'gwaecae-auth@example.test'::text,
    'still readable for a manual_attention_required (blocking) operation'
);

UPDATE public.worker_access_email_corrections SET state = 'completed' WHERE id = :op_id;

SELECT throws_ok(
    format($$SELECT public.get_worker_access_email_correction_auth_email(%L)$$, :op_id),
    'WAEC5',
    NULL,
    'raises WAEC5 for a completed (non-blocking) operation'
);

SELECT * FROM finish();

ROLLBACK;
