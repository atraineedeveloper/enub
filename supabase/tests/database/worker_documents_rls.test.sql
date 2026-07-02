BEGIN;

SET search_path = public, extensions;

SELECT plan(20);

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

SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'worker_documents'
            AND cmd = 'SELECT'
            AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
    ),
    'anon cannot select worker_documents rows'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'worker_documents'
            AND cmd = 'INSERT'
            AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
    ),
    'anon cannot insert worker_documents'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'worker_documents'
            AND cmd = 'UPDATE'
            AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
    ),
    'anon cannot update worker_documents'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'worker_documents'
            AND cmd = 'DELETE'
            AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
    ),
    'anon cannot delete worker_documents'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'worker_documents'
            AND cmd = 'SELECT'
            AND 'authenticated' = ANY(roles)
    ),
    'authenticated can select worker_documents'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'worker_documents'
            AND cmd = 'INSERT'
            AND 'authenticated' = ANY(roles)
    ),
    'authenticated can insert worker_documents'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'worker_documents'
            AND cmd = 'UPDATE'
            AND 'authenticated' = ANY(roles)
    ),
    'authenticated can update worker_documents'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'worker_documents'
            AND cmd = 'DELETE'
            AND 'authenticated' = ANY(roles)
    ),
    'authenticated can delete worker_documents'
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

SELECT is(
    (
        SELECT count(*)
        FROM pg_policies
        WHERE schemaname = 'storage'
            AND tablename = 'objects'
            AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
            AND 'authenticated' = ANY(roles)
            AND COALESCE(qual, with_check, '') LIKE '%worker_documents%'
    ),
    4::bigint,
    'storage.objects policies exist for worker_documents'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
            AND tablename = 'objects'
            AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
            AND ('public' = ANY(roles) OR 'anon' = ANY(roles))
            AND COALESCE(qual, with_check, '') LIKE '%worker_documents%'
    ),
    'worker_documents storage policies are scoped to authenticated access'
);

SELECT * FROM finish();

ROLLBACK;
