BEGIN;

SET search_path = public, extensions;

SELECT plan(11);

SELECT ok(to_regclass('public.worker_document_categories') IS NOT NULL, 'worker_document_categories table exists');
SELECT ok(to_regclass('public.worker_document_types') IS NOT NULL, 'worker_document_types table exists');
SELECT ok(to_regclass('public.worker_documents') IS NOT NULL, 'worker_documents table exists');

SELECT is(
    (
        SELECT format_type(attribute.atttypid, attribute.atttypmod)
        FROM pg_attribute AS attribute
        JOIN pg_class AS relation ON relation.oid = attribute.attrelid
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
            AND relation.relname = 'worker_documents'
            AND attribute.attname = 'worker_id'
    ),
    'bigint',
    'worker_documents.worker_id is bigint'
);

SELECT is(
    (
        SELECT format_type(attribute.atttypid, attribute.atttypmod)
        FROM pg_attribute AS attribute
        JOIN pg_class AS relation ON relation.oid = attribute.attrelid
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
            AND relation.relname = 'worker_documents'
            AND attribute.attname = 'document_type_id'
    ),
    'bigint',
    'worker_documents.document_type_id is bigint'
);

SELECT is(
    (
        SELECT format_type(attribute.atttypid, attribute.atttypmod)
        FROM pg_attribute AS attribute
        JOIN pg_class AS relation ON relation.oid = attribute.attrelid
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
            AND relation.relname = 'worker_documents'
            AND attribute.attname = 'semester_id'
    ),
    'bigint',
    'worker_documents.semester_id is bigint'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_constraint AS constraint_definition
        JOIN pg_class AS relation ON relation.oid = constraint_definition.conrelid
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
            AND relation.relname = 'worker_documents'
            AND constraint_definition.contype = 'u'
            AND pg_get_constraintdef(constraint_definition.oid) = 'UNIQUE (storage_path)'
    ),
    'worker_documents has UNIQUE(storage_path)'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM pg_constraint AS constraint_definition
        JOIN pg_class AS relation ON relation.oid = constraint_definition.conrelid
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
            AND relation.relname = 'worker_documents'
            AND constraint_definition.contype = 'c'
            AND constraint_definition.conname = 'worker_documents_file_size_check'
            AND pg_get_constraintdef(constraint_definition.oid) LIKE '%file_size% > 0%'
            AND pg_get_constraintdef(constraint_definition.oid) LIKE '%file_size% <= 10485760%'
    ),
    'worker_documents has the expected file_size check'
);

CREATE TEMP TABLE worker_documents_schema_ids AS
WITH worker_insert AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Worker Documents Schema', 'QA', 1)
    RETURNING id
),
document_type_lookup AS (
    SELECT worker_document_types.id
    FROM public.worker_document_types
    JOIN public.worker_document_categories
        ON worker_document_categories.id = worker_document_types.category_id
    WHERE worker_document_categories.name = 'Datos personales'
        AND worker_document_types.name = 'CURP'
)
SELECT
    worker_insert.id AS worker_id,
    document_type_lookup.id AS document_type_id
FROM worker_insert, document_type_lookup;

SELECT throws_ok(
    $$
    INSERT INTO public.worker_documents (
        worker_id,
        document_type_id,
        semester_id,
        file_name,
        storage_path,
        mime_type,
        file_size
    )
    SELECT
        worker_id,
        document_type_id,
        NULL,
        'empty.pdf',
        'schema/empty.pdf',
        'application/pdf',
        0
    FROM worker_documents_schema_ids
    $$,
    '23514',
    'new row for relation "worker_documents" violates check constraint "worker_documents_file_size_check"',
    'worker_documents rejects file_size = 0'
);

SELECT throws_ok(
    $$
    INSERT INTO public.worker_documents (
        worker_id,
        document_type_id,
        semester_id,
        file_name,
        storage_path,
        mime_type,
        file_size
    )
    SELECT
        worker_id,
        document_type_id,
        NULL,
        'too-large.pdf',
        'schema/too-large.pdf',
        'application/pdf',
        10485761
    FROM worker_documents_schema_ids
    $$,
    '23514',
    'new row for relation "worker_documents" violates check constraint "worker_documents_file_size_check"',
    'worker_documents rejects file_size > 10485760'
);

SELECT lives_ok(
    $$
    INSERT INTO public.worker_documents (
        worker_id,
        document_type_id,
        semester_id,
        file_name,
        storage_path,
        mime_type,
        file_size
    )
    SELECT
        worker_id,
        document_type_id,
        NULL,
        'valid.pdf',
        'schema/valid.pdf',
        'application/pdf',
        10485760
    FROM worker_documents_schema_ids
    $$,
    'worker_documents accepts file_size = 10485760'
);

SELECT * FROM finish();

ROLLBACK;
