-- Coverage for get_linked_worker_auth_email_context (code-review finding
-- #9, add-worker-access-email-correction): a worker-bound raw Auth email
-- read for the browser-facing get-worker-access-email-context Edge
-- Function, exposing no arbitrary-UUID lookup capability.

BEGIN;

SET search_path = public, extensions;

SELECT plan(8);

-- Grant/ownership rigor -----------------------------------------------

SELECT ok(
    (
        SELECT prosecdef
        FROM pg_proc
        WHERE proname = 'get_linked_worker_auth_email_context' AND pronamespace = 'public'::regnamespace
    ),
    'get_linked_worker_auth_email_context is SECURITY DEFINER'
);

SELECT is(
    (
        SELECT pg_get_userbyid(proowner)
        FROM pg_proc
        WHERE proname = 'get_linked_worker_auth_email_context' AND pronamespace = 'public'::regnamespace
    ),
    'postgres'::name,
    'get_linked_worker_auth_email_context is owned by postgres'
);

SELECT ok(
    (
        SELECT proconfig @> ARRAY['search_path=""']
        FROM pg_proc
        WHERE proname = 'get_linked_worker_auth_email_context' AND pronamespace = 'public'::regnamespace
    ),
    'get_linked_worker_auth_email_context has a fixed, empty search_path'
);

SELECT ok(
    NOT has_function_privilege('anon', 'public.get_linked_worker_auth_email_context(bigint)', 'EXECUTE'),
    'anon cannot execute get_linked_worker_auth_email_context'
);

SELECT ok(
    NOT has_function_privilege('authenticated', 'public.get_linked_worker_auth_email_context(bigint)', 'EXECUTE'),
    'authenticated cannot execute get_linked_worker_auth_email_context'
);

SELECT ok(
    has_function_privilege('service_role', 'public.get_linked_worker_auth_email_context(bigint)', 'EXECUTE'),
    'service_role can execute get_linked_worker_auth_email_context'
);

-- Behavior ---------------------------------------------------------------

WITH w AS (
    INSERT INTO public.workers (name, type_worker, status, email) VALUES ('GLWAEC Worker', 'QA', 1, 'glwaec-worker@example.test') RETURNING id
)
SELECT id AS worker_id FROM w \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '82000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'glwaec-auth@example.test', 'x', now(), '{}', '{}', now(), now());
INSERT INTO public.profiles (id, role, worker_id) VALUES ('82000000-0000-0000-0000-000000000001', 'worker', :worker_id);

SELECT is(
    public.get_linked_worker_auth_email_context(:worker_id),
    'glwaec-auth@example.test'::text,
    'returns the linked Auth user''s current raw email for a linked worker'
);

SELECT throws_ok(
    $$SELECT public.get_linked_worker_auth_email_context(999999999)$$,
    'WAEC6',
    NULL,
    'raises WAEC6 for a worker with no linked profile'
);

SELECT * FROM finish();

ROLLBACK;
