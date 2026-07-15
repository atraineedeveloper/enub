-- Coverage for the worker_access_email_corrections table itself
-- (design.md §5, tasks.md §2): the two partial unique indexes, check
-- constraints, and the no-direct-grant policy.

BEGIN;

SET search_path = public, extensions;

SELECT plan(10);

SELECT is(
    (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE relname = 'worker_access_email_corrections' AND relnamespace = 'public'::regnamespace),
    'postgres'::name,
    'worker_access_email_corrections is owned by postgres'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = 'worker_access_email_corrections'
          AND grantee IN ('PUBLIC', 'anon', 'authenticated')
    ),
    'no grant of any kind exists on worker_access_email_corrections for PUBLIC/anon/authenticated'
);

-- Fixtures: two distinct workers, two distinct Auth users.
WITH w_a AS (
    INSERT INTO public.workers (name, type_worker, status) VALUES ('WAEC Schema Worker A', 'QA', 1) RETURNING id
),
w_b AS (
    INSERT INTO public.workers (name, type_worker, status) VALUES ('WAEC Schema Worker B', 'QA', 1) RETURNING id
)
SELECT w_a.id AS worker_a_id, w_b.id AS worker_b_id FROM w_a, w_b \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', '71000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'waec-schema-a@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '71000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'waec-schema-b@example.test', 'x', now(), '{}', '{}', now(), now());

-- state check constraint --------------------------------------------------

SELECT throws_ok(
    format(
        $$INSERT INTO public.worker_access_email_corrections (worker_id, linked_auth_user_id, requested_canonical_email, state) VALUES (%L, '71000000-0000-0000-0000-000000000001', 'target@example.test', 'bogus_state')$$,
        :'worker_a_id'
    ),
    '23514',
    NULL,
    'an invalid state value is rejected by the check constraint'
);

-- requested_canonical_email check constraint ------------------------------

SELECT throws_ok(
    format(
        $$INSERT INTO public.worker_access_email_corrections (worker_id, linked_auth_user_id, requested_canonical_email, state) VALUES (%L, '71000000-0000-0000-0000-000000000001', '', 'active')$$,
        :'worker_a_id'
    ),
    '23514',
    NULL,
    'an empty requested_canonical_email is rejected'
);

SELECT throws_ok(
    format(
        $$INSERT INTO public.worker_access_email_corrections (worker_id, linked_auth_user_id, requested_canonical_email, state) VALUES (%L, '71000000-0000-0000-0000-000000000001', '  Not-Canonical@Example.TEST', 'active')$$,
        :'worker_a_id'
    ),
    '23514',
    NULL,
    'a non-canonical (mixed-case/whitespace) requested_canonical_email is rejected'
);

-- last_reason_code check constraint ---------------------------------------

SELECT lives_ok(
    format(
        $$INSERT INTO public.worker_access_email_corrections (worker_id, linked_auth_user_id, requested_canonical_email, state, last_reason_code) VALUES (%L, '71000000-0000-0000-0000-000000000001', 'target-a@example.test', 'active', NULL)$$,
        :'worker_a_id'
    ),
    'last_reason_code accepts NULL'
);

SELECT throws_ok(
    format(
        $$INSERT INTO public.worker_access_email_corrections (worker_id, linked_auth_user_id, requested_canonical_email, state, last_reason_code) VALUES (%L, '71000000-0000-0000-0000-000000000002', 'target-b@example.test', 'active', 'not_a_real_reason_code')$$,
        :'worker_b_id'
    ),
    '23514',
    NULL,
    'a last_reason_code outside the closed set is rejected'
);

-- Partial unique index on worker_id ----------------------------------------

SELECT throws_ok(
    format(
        $$INSERT INTO public.worker_access_email_corrections (worker_id, linked_auth_user_id, requested_canonical_email, state) VALUES (%L, '71000000-0000-0000-0000-000000000002', 'a-second-active-target@example.test', 'active')$$,
        :'worker_a_id'
    ),
    '23505',
    NULL,
    'a second active row for the same worker_id is rejected by the partial unique index'
);

-- Partial unique index on linked_auth_user_id ------------------------------

SELECT throws_ok(
    format(
        $$INSERT INTO public.worker_access_email_corrections (worker_id, linked_auth_user_id, requested_canonical_email, state) VALUES (%L, '71000000-0000-0000-0000-000000000001', 'a-second-active-target-2@example.test', 'active')$$,
        :'worker_b_id'
    ),
    '23505',
    NULL,
    'a second active row for the same linked_auth_user_id is rejected by the partial unique index'
);

-- A completed row does not trigger either partial index -------------------

UPDATE public.worker_access_email_corrections
SET state = 'completed'
WHERE worker_id = :worker_a_id;

SELECT lives_ok(
    format(
        $$INSERT INTO public.worker_access_email_corrections (worker_id, linked_auth_user_id, requested_canonical_email, state) VALUES (%L, '71000000-0000-0000-0000-000000000001', 'a-new-active-target@example.test', 'active')$$,
        :'worker_a_id'
    ),
    'a completed row does not block a new active row for the same worker_id/linked_auth_user_id'
);

SELECT * FROM finish();

ROLLBACK;
