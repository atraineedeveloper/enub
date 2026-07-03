BEGIN;

SET search_path = public, extensions;

-- Behavioral coverage of the storage.objects policies for the
-- worker_documents bucket (structural shape is covered in
-- worker_documents_rls.test.sql). Rows are inserted directly into
-- storage.objects rather than through the Storage API -- RLS applies at
-- the table level regardless of how a row gets there, and the ownership
-- check is purely path-based: (storage.foldername(name))[1] against
-- current_worker_id(). See database-plan.md §9.

SELECT plan(7);

CREATE TEMP TABLE wd_storage_ids AS
WITH worker_a AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA WD Storage Worker A', 'QA', 1)
    RETURNING id
),
worker_b AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA WD Storage Worker B', 'QA', 1)
    RETURNING id
)
SELECT worker_a.id AS worker_a_id, worker_b.id AS worker_b_id
FROM worker_a, worker_b;

SELECT worker_a_id, worker_b_id FROM wd_storage_ids \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'wd-storage-staff@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'wd-storage-worker-a@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'wd-storage-noaccess@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id)
VALUES ('e0000000-0000-0000-0000-000000000001', 'staff', NULL);

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'e0000000-0000-0000-0000-000000000002', 'worker', worker_a_id FROM wd_storage_ids;

-- Fixture storage objects for both workers' paths, inserted as the
-- connecting role (bypasses RLS).
INSERT INTO storage.objects (bucket_id, name)
VALUES
    ('worker_documents', :'worker_a_id' || '/1/permanent/fixture-a.pdf'),
    ('worker_documents', :'worker_b_id' || '/1/permanent/fixture-b.pdf');

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
SELECT (SELECT count(*) FROM storage.objects WHERE bucket_id = 'worker_documents') AS worker_a_visible_count \gset
SELECT (
    SELECT count(*) FROM storage.objects
    WHERE bucket_id = 'worker_documents' AND name = :'worker_b_id' || '/1/permanent/fixture-b.pdf'
) AS worker_a_sees_worker_b \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'worker_a_visible_count'::bigint, 1::bigint, 'worker A session sees exactly one storage object in the worker_documents bucket');
SELECT is(:'worker_a_sees_worker_b'::bigint, 0::bigint, 'worker A session cannot see worker B''s object by path');

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000001';
SELECT (SELECT count(*) FROM storage.objects WHERE bucket_id = 'worker_documents') AS staff_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'staff_visible_count'::bigint, 2::bigint, 'a staff session sees every storage object in the worker_documents bucket');

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000003';
SELECT (SELECT count(*) FROM storage.objects WHERE bucket_id = 'worker_documents') AS noaccess_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'noaccess_visible_count'::bigint, 0::bigint, 'a session with no profiles row sees no storage objects in the worker_documents bucket');

-- INSERT as worker A under their own path prefix succeeds.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
SELECT lives_ok(
    format(
        $$INSERT INTO storage.objects (bucket_id, name) VALUES ('worker_documents', %L)$$,
        :'worker_a_id' || '/1/permanent/new-a.pdf'
    ),
    'worker A can insert a storage object under their own path prefix'
);
RESET role;
RESET "request.jwt.claim.sub";

-- INSERT as worker A under worker B's path prefix is rejected by WITH CHECK.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
SELECT throws_ok(
    format(
        $$INSERT INTO storage.objects (bucket_id, name) VALUES ('worker_documents', %L)$$,
        :'worker_b_id' || '/1/permanent/new-b.pdf'
    ),
    '42501',
    NULL,
    'worker A cannot insert a storage object under worker B''s path prefix'
);
RESET role;
RESET "request.jwt.claim.sub";

-- A path with no recognizable worker prefix (or a non-numeric one) is
-- never matched by (storage.foldername(name))[1] = current_worker_id()::text,
-- and is not covered by the staff/admin policy either -- correctly denied.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
SELECT throws_ok(
    $$INSERT INTO storage.objects (bucket_id, name) VALUES ('worker_documents', 'not-a-worker-id/1/permanent/x.pdf')$$,
    '42501',
    NULL,
    'worker A cannot insert a storage object under a non-matching path prefix'
);
RESET role;
RESET "request.jwt.claim.sub";

SELECT * FROM finish();

ROLLBACK;
