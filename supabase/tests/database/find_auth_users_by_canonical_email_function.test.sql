-- Coverage for find_auth_users_by_canonical_email (design.md §3, tasks.md §1):
-- a server-only, service-role-only canonical-email lookup added for
-- add-worker-access-email-correction.

BEGIN;

SET search_path = public, extensions;

SELECT plan(10);

-- Grant/ownership rigor -----------------------------------------------

SELECT ok(
    (
        SELECT prosecdef
        FROM pg_proc
        WHERE proname = 'find_auth_users_by_canonical_email' AND pronamespace = 'public'::regnamespace
    ),
    'find_auth_users_by_canonical_email is SECURITY DEFINER'
);

SELECT is(
    (
        SELECT pg_get_userbyid(proowner)
        FROM pg_proc
        WHERE proname = 'find_auth_users_by_canonical_email' AND pronamespace = 'public'::regnamespace
    ),
    'postgres'::name,
    'find_auth_users_by_canonical_email is owned by postgres'
);

SELECT ok(
    (
        SELECT proconfig @> ARRAY['search_path=""']
        FROM pg_proc
        WHERE proname = 'find_auth_users_by_canonical_email' AND pronamespace = 'public'::regnamespace
    ),
    'find_auth_users_by_canonical_email has a fixed, empty search_path'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM pg_proc, aclexplode(proacl) a
        WHERE proname = 'find_auth_users_by_canonical_email' AND pronamespace = 'public'::regnamespace
          AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
    ),
    'PUBLIC cannot execute find_auth_users_by_canonical_email'
);

SELECT ok(
    NOT has_function_privilege('anon', 'public.find_auth_users_by_canonical_email(text)', 'EXECUTE'),
    'anon cannot execute find_auth_users_by_canonical_email'
);

SELECT ok(
    NOT has_function_privilege('authenticated', 'public.find_auth_users_by_canonical_email(text)', 'EXECUTE'),
    'authenticated cannot execute find_auth_users_by_canonical_email'
);

SELECT ok(
    has_function_privilege('service_role', 'public.find_auth_users_by_canonical_email(text)', 'EXECUTE'),
    'service_role can execute find_auth_users_by_canonical_email'
);

-- Match-count behavior ---------------------------------------------------

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', '70000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'faucbce-single@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '70000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'FAUCBCE-Dup@Example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '70000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', '  faucbce-dup@example.test  ', 'x', now(), '{}', '{}', now(), now());

SELECT is(
    (SELECT count(*) FROM public.find_auth_users_by_canonical_email('nobody-matches-this@example.test'))::int,
    0,
    'zero rows for no match'
);

SELECT is(
    (SELECT count(*) FROM public.find_auth_users_by_canonical_email('  FAUCBCE-Single@Example.test  '))::int,
    1,
    'exactly one row for a single case/whitespace-variant match'
);

SELECT is(
    (SELECT count(*) FROM public.find_auth_users_by_canonical_email('faucbce-dup@example.test'))::int,
    2,
    'more than one row for a canonical (non-byte-identical) duplicate'
);

SELECT * FROM finish();

ROLLBACK;
