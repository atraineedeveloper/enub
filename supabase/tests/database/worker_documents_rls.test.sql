BEGIN;

SET search_path = public, extensions;

-- NOTE: worker_documents and the worker_documents storage bucket policies
-- were replaced by the worker-self-service-documents feature with ownership-
-- scoped FOR ALL policies (staff/admin: unrestricted; worker: own worker_id
-- only) instead of one blanket policy per command. The structural
-- assertions below were updated to match that shape. Behavioral coverage of
-- the ownership scoping itself lives in worker_documents_ownership_rls.test.sql
-- and worker_documents_storage_rls.test.sql.

SELECT plan(17);

SELECT ok(
    (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'public.worker_document_categories'::regclass
    ),
    'RLS is enabled on worker_document_categories'
);

SELECT ok(
    (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'public.worker_document_types'::regclass
    ),
    'RLS is enabled on worker_document_types'
);

SELECT ok(
    (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'public.worker_documents'::regclass
    ),
    'RLS is enabled on worker_documents'
);

SELECT ok(
    (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'storage.objects'::regclass
    ),
    'RLS is enabled on storage.objects'
);

SELECT ok(
    has_table_privilege('anon', 'public.worker_document_categories', 'SELECT')
        AND EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
                AND tablename = 'worker_document_categories'
                AND cmd = 'SELECT'
                AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
        ),
    'anon can select worker_document_categories'
);

SELECT ok(
    has_table_privilege('anon', 'public.worker_document_types', 'SELECT')
        AND EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
                AND tablename = 'worker_document_types'
                AND cmd = 'SELECT'
                AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
        ),
    'anon can select worker_document_types'
);

-- Shape-agnostic: true whether policies are one-per-command or FOR ALL.
SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'worker_documents'
            AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
    ),
    'anon has no policy at all on worker_documents'
);

-- worker-self-service-documents replaced the four single-command
-- "any authenticated user" policies with exactly two ownership-scoped
-- FOR ALL policies. See decisions.md #13 and database-plan.md §8.
SELECT is(
    (
        SELECT count(*)
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'worker_documents'
    ),
    2::bigint,
    'worker_documents has exactly two RLS policies (staff/admin + worker ownership)'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'worker_documents'
            AND policyname = 'Staff and admin manage all worker documents'
            AND cmd = 'ALL'
            AND 'authenticated' = ANY(roles)
            AND qual LIKE '%current_app_role%'
            AND with_check LIKE '%current_app_role%'
    ),
    'staff/admin worker_documents policy is FOR ALL, authenticated-only, and role-scoped'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'worker_documents'
            AND policyname = 'Workers manage own worker documents'
            AND cmd = 'ALL'
            AND 'authenticated' = ANY(roles)
            AND qual LIKE '%current_worker_id%'
            AND with_check LIKE '%current_worker_id%'
    ),
    'worker-ownership worker_documents policy is FOR ALL, authenticated-only, and worker_id-scoped'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM storage.buckets
        WHERE id = 'worker_documents'
    ),
    'worker_documents storage bucket exists'
);

SELECT is(
    (
        SELECT public
        FROM storage.buckets
        WHERE id = 'worker_documents'
    ),
    false,
    'worker_documents bucket is private'
);

SELECT is(
    (
        SELECT file_size_limit
        FROM storage.buckets
        WHERE id = 'worker_documents'
    ),
    10485760::bigint,
    'worker_documents bucket file_size_limit is 10485760'
);

SELECT ok(
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
        'image/webp'
    ]::text[] <@ (
        SELECT allowed_mime_types
        FROM storage.buckets
        WHERE id = 'worker_documents'
    ),
    'worker_documents bucket includes the expected MIME allowlist'
);

-- Replaced by two ownership-scoped FOR ALL policies (staff/admin +
-- worker path-prefix), same shape change as worker_documents itself.
-- See decisions.md #14 and database-plan.md §9.
SELECT is(
    (
        SELECT count(*)
        FROM pg_policies
        WHERE schemaname = 'storage'
            AND tablename = 'objects'
            AND cmd = 'ALL'
            AND 'authenticated' = ANY(roles)
            AND COALESCE(qual, with_check, '') LIKE '%worker_documents%'
    ),
    2::bigint,
    'storage.objects has exactly two FOR ALL policies scoped to worker_documents'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
            AND tablename = 'objects'
            AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
            AND COALESCE(qual, with_check, '') LIKE '%worker_documents%'
    ),
    'worker_documents storage policies are scoped to authenticated access'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
            AND tablename = 'objects'
            AND policyname = 'Workers access own worker documents bucket path'
            AND qual LIKE '%foldername%'
            AND qual LIKE '%current_worker_id%'
    ),
    'worker storage policy scopes by path prefix via storage.foldername + current_worker_id'
);

SELECT * FROM finish();

ROLLBACK;
