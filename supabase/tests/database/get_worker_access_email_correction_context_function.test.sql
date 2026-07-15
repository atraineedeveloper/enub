-- Coverage for get_worker_access_email_correction_context (design.md §10,
-- tasks.md §4): a read-only, service-role-only internal RPC, distinct from
-- the browser-facing get-worker-access-email-context Edge Function.

BEGIN;

SET search_path = public, extensions;

SELECT plan(9);

SELECT ok(
    (
        SELECT prosecdef
        FROM pg_proc
        WHERE proname = 'get_worker_access_email_correction_context' AND pronamespace = 'public'::regnamespace
    ),
    'get_worker_access_email_correction_context is SECURITY DEFINER'
);

SELECT is(
    (
        SELECT pg_get_userbyid(proowner)
        FROM pg_proc
        WHERE proname = 'get_worker_access_email_correction_context' AND pronamespace = 'public'::regnamespace
    ),
    'postgres'::name,
    'get_worker_access_email_correction_context is owned by postgres'
);

SELECT ok(
    (
        SELECT proconfig @> ARRAY['search_path=""']
        FROM pg_proc
        WHERE proname = 'get_worker_access_email_correction_context' AND pronamespace = 'public'::regnamespace
    ),
    'get_worker_access_email_correction_context has a fixed, empty search_path'
);

SELECT ok(
    NOT has_function_privilege('anon', 'public.get_worker_access_email_correction_context(bigint)', 'EXECUTE'),
    'anon cannot execute get_worker_access_email_correction_context'
);

SELECT ok(
    NOT has_function_privilege('authenticated', 'public.get_worker_access_email_correction_context(bigint)', 'EXECUTE'),
    'authenticated cannot execute get_worker_access_email_correction_context'
);

SELECT ok(
    has_function_privilege('service_role', 'public.get_worker_access_email_correction_context(bigint)', 'EXECUTE'),
    'service_role can execute get_worker_access_email_correction_context'
);

-- Behavior ---------------------------------------------------------------

WITH w AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('GWAECC Worker', 'QA', 1, 'gwaecc-worker@example.test') RETURNING id
)
SELECT id AS worker_id FROM w \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '73000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'gwaecc-auth@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id) VALUES ('73000000-0000-0000-0000-000000000001', 'worker', :worker_id);

SELECT operation_id AS op_id FROM public.claim_worker_access_email_correction(:worker_id, 'gwaecc-target@example.test') \gset

SELECT is(
    (SELECT worker_id FROM public.get_worker_access_email_correction_context(:op_id)),
    :worker_id::bigint,
    'returns the correct worker_id for a valid operation id'
);

SELECT is(
    (SELECT requested_canonical_email FROM public.get_worker_access_email_correction_context(:op_id)),
    'gwaecc-target@example.test'::text,
    'returns the correct requested_canonical_email for a valid operation id'
);

SELECT throws_ok(
    $$SELECT * FROM public.get_worker_access_email_correction_context(999999999)$$,
    'WAEC2',
    NULL,
    'raises for a nonexistent operation id'
);

SELECT * FROM finish();

ROLLBACK;
