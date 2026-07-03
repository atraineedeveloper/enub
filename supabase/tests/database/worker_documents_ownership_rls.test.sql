BEGIN;

SET search_path = public, extensions;

-- Behavioral coverage of the ownership-scoped worker_documents policies
-- (structural shape is covered in worker_documents_rls.test.sql). This file
-- verifies that a worker session can only see/insert/delete rows for its
-- own worker_id, staff/admin see everything, and a no-role session sees
-- nothing -- exercised via real RLS enforcement, not just policy metadata.

SELECT plan(8);

CREATE TEMP TABLE wd_ownership_ids AS
WITH worker_a AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA WD Ownership Worker A', 'QA', 1)
    RETURNING id
),
worker_b AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA WD Ownership Worker B', 'QA', 1)
    RETURNING id
),
semester_insert AS (
    INSERT INTO public.semesters (semester, school_year)
    VALUES ('QA WD Ownership', '2026-2027')
    RETURNING id
),
document_type_lookup AS (
    SELECT worker_document_types.id
    FROM public.worker_document_types
    JOIN public.worker_document_categories
        ON worker_document_categories.id = worker_document_types.category_id
    WHERE worker_document_categories.name = 'Datos personales'
        AND worker_document_types.name = 'CURP'
),
-- A multi-file ("Evidencias") type, used for the insert tests below so they
-- don't collide with the single-file CURP fixture row already seeded for
-- worker A -- that collision would trip enforce_single_worker_document_file,
-- an unrelated trigger, not the RLS behavior this file is testing.
evidence_type_lookup AS (
    SELECT worker_document_types.id
    FROM public.worker_document_types
    JOIN public.worker_document_categories
        ON worker_document_categories.id = worker_document_types.category_id
    WHERE worker_document_categories.name = 'Docencia'
        AND worker_document_types.name = 'Evidencias'
)
SELECT
    worker_a.id AS worker_a_id,
    worker_b.id AS worker_b_id,
    semester_insert.id AS semester_id,
    document_type_lookup.id AS document_type_id,
    evidence_type_lookup.id AS evidence_type_id
FROM worker_a, worker_b, semester_insert, document_type_lookup, evidence_type_lookup;

-- Captured into psql variables (not re-queried later) because this temp
-- table is only accessible to the connecting role -- later statements in
-- this file run under `SET LOCAL role authenticated`, which cannot see it.
SELECT worker_a_id, worker_b_id, semester_id, document_type_id, evidence_type_id FROM wd_ownership_ids \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'wd-ownership-staff@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'wd-ownership-worker-a@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'wd-ownership-noaccess@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id)
VALUES ('d0000000-0000-0000-0000-000000000001', 'staff', NULL);

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'd0000000-0000-0000-0000-000000000002', 'worker', worker_a_id FROM wd_ownership_ids;

-- Fixture documents for both workers, inserted as the connecting role
-- (bypasses RLS, same as any direct-DB setup step in the existing suite).
INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
SELECT worker_a_id, document_type_id, NULL, 'curp-a.pdf', 'ownership/curp-a.pdf', 'application/pdf', 100
FROM wd_ownership_ids;

INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
SELECT worker_b_id, document_type_id, NULL, 'curp-b.pdf', 'ownership/curp-b.pdf', 'application/pdf', 100
FROM wd_ownership_ids;

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'd0000000-0000-0000-0000-000000000002';
SELECT (SELECT count(*) FROM public.worker_documents) AS worker_a_visible_count \gset
SELECT (SELECT count(*) FROM public.worker_documents WHERE storage_path = 'ownership/curp-b.pdf') AS worker_a_sees_worker_b \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'worker_a_visible_count'::bigint, 1::bigint, 'worker A session sees exactly one worker_documents row');
SELECT is(:'worker_a_sees_worker_b'::bigint, 0::bigint, 'worker A session cannot see worker B''s document by storage_path');

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'd0000000-0000-0000-0000-000000000001';
SELECT (SELECT count(*) FROM public.worker_documents) AS staff_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'staff_visible_count'::bigint, 2::bigint, 'a staff session sees every worker_documents row');

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'd0000000-0000-0000-0000-000000000003';
SELECT (SELECT count(*) FROM public.worker_documents) AS noaccess_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'noaccess_visible_count'::bigint, 0::bigint, 'a session with no profiles row sees no worker_documents');

-- INSERT as worker A for worker A's own worker_id succeeds.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'd0000000-0000-0000-0000-000000000002';
SELECT lives_ok(
    format(
        $$
        INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
        VALUES (%L, %L, %L, 'evidence-a.pdf', 'ownership/evidence-a.pdf', 'application/pdf', 100)
        $$,
        :'worker_a_id',
        :'evidence_type_id',
        :'semester_id'
    ),
    'worker A can insert a worker_documents row for their own worker_id'
);
RESET role;
RESET "request.jwt.claim.sub";

-- INSERT as worker A for worker B's worker_id is rejected by WITH CHECK.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'd0000000-0000-0000-0000-000000000002';
SELECT throws_ok(
    format(
        $$
        INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
        VALUES (%L, %L, %L, 'evidence-b.pdf', 'ownership/evidence-b.pdf', 'application/pdf', 100)
        $$,
        :'worker_b_id',
        :'evidence_type_id',
        :'semester_id'
    ),
    '42501',
    NULL,
    'worker A cannot insert a worker_documents row for worker B''s worker_id'
);
RESET role;
RESET "request.jwt.claim.sub";

-- DELETE as worker A of their own document succeeds.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'd0000000-0000-0000-0000-000000000002';
SELECT lives_ok(
    $$DELETE FROM public.worker_documents WHERE storage_path = 'ownership/curp-a.pdf'$$,
    'worker A can delete their own worker_documents row'
);
RESET role;
RESET "request.jwt.claim.sub";

-- DELETE as worker A of worker B's document affects zero rows (RLS filters
-- it out silently -- it is not visible to delete, not an error).
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'd0000000-0000-0000-0000-000000000002';
DELETE FROM public.worker_documents WHERE storage_path = 'ownership/curp-b.pdf';
RESET role;
RESET "request.jwt.claim.sub";

SELECT ok(
    EXISTS (SELECT 1 FROM public.worker_documents WHERE storage_path = 'ownership/curp-b.pdf'),
    'worker B''s document still exists after worker A''s no-op delete attempt (RLS filtered it, not a real delete)'
);

SELECT * FROM finish();

ROLLBACK;
