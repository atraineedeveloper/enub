BEGIN;

SET search_path = public, extensions;

SELECT plan(23);

CREATE TEMP TABLE worker_documents_trigger_ids AS
WITH worker_insert AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Worker Documents Triggers', 'QA', 1)
    RETURNING id
),
semester_insert AS (
    INSERT INTO public.semesters (semester, school_year)
    VALUES ('QA', '2026-2027')
    RETURNING id
),
type_lookup AS (
    SELECT
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Datos personales'
                AND worker_document_types.name = 'CURP'
        ) AS permanent_type_id,
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Planeación semestral'
        ) AS semester_type_id,
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Evidencias bimestrales'
        ) AS evidence_type_id,
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Plan de trabajo semestral'
        ) AS inactive_type_id,
        -- The remaining 5 active Docencia types
        -- 20260721010000_docencia_active_types_allow_multiple.sql flips to
        -- allows_multiple = true (semester_type_id/Planeación semestral and
        -- evidence_type_id/Evidencias bimestrales above cover the other 2
        -- of the 7).
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Rúbricas'
        ) AS rubricas_type_id,
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Listas de cotejo'
        ) AS listas_cotejo_type_id,
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Listas de asistencia'
        ) AS listas_asistencia_type_id,
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Actas de evaluación'
        ) AS actas_evaluacion_type_id,
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Concentrado de calificaciones finales'
        ) AS concentrado_type_id
    FROM public.worker_document_types
    JOIN public.worker_document_categories
        ON worker_document_categories.id = worker_document_types.category_id
)
SELECT
    worker_insert.id AS worker_id,
    semester_insert.id AS semester_id,
    type_lookup.permanent_type_id,
    type_lookup.semester_type_id,
    type_lookup.evidence_type_id,
    type_lookup.inactive_type_id,
    type_lookup.rubricas_type_id,
    type_lookup.listas_cotejo_type_id,
    type_lookup.listas_asistencia_type_id,
    type_lookup.actas_evaluacion_type_id,
    type_lookup.concentrado_type_id
FROM worker_insert, semester_insert, type_lookup;

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
        permanent_type_id,
        semester_id,
        'curp.pdf',
        'triggers/permanent-with-semester.pdf',
        'application/pdf',
        100
    FROM worker_documents_trigger_ids
    $$,
    'P0001',
    'Permanent worker documents cannot be tied to a semester',
    'permanent document with non-null semester_id is rejected'
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
        semester_type_id,
        NULL,
        'planeacion.pdf',
        'triggers/semester-without-semester.pdf',
        'application/pdf',
        100
    FROM worker_documents_trigger_ids
    $$,
    'P0001',
    'Semester worker documents require semester_id',
    'semester-scoped document with null semester_id is rejected'
);

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
    permanent_type_id,
    NULL,
    'curp-a.pdf',
    'triggers/curp-a.pdf',
    'application/pdf',
    100
FROM worker_documents_trigger_ids;

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
        permanent_type_id,
        NULL,
        'curp-b.pdf',
        'triggers/curp-b.pdf',
        'application/pdf',
        100
    FROM worker_documents_trigger_ids
    $$,
    'P0001',
    'This worker document type allows only one active file for the selected scope',
    'duplicate single-file document for same worker/type/scope is rejected'
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
        evidence_type_id,
        semester_id,
        'evidence-a.pdf',
        'triggers/evidence-a.pdf',
        'application/pdf',
        100
    FROM worker_documents_trigger_ids;

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
        evidence_type_id,
        semester_id,
        'evidence-b.pdf',
        'triggers/evidence-b.pdf',
        'application/pdf',
        100
    FROM worker_documents_trigger_ids;
    $$,
    'multiple Evidencias bimestrales documents for same worker/type/scope are allowed'
);

-- 20260721010000_docencia_active_types_allow_multiple.sql (Item 22
-- coverage): the trigger admits a 2nd and 3rd file, with no exception, for
-- EVERY one of the 7 active Docencia types -- not just Evidencias
-- bimestrales, which already allowed multiple files before that
-- migration. Each block inserts 3 documents (1st/2nd/3rd) for the same
-- worker/type/semester scope and confirms all 3 persist.
SELECT lives_ok(
    format(
        $$
        INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
        VALUES
            (%1$L, %2$L, %3$L, 'planeacion-multi-1.pdf', 'triggers/planeacion-multi-1.pdf', 'application/pdf', 100),
            (%1$L, %2$L, %3$L, 'planeacion-multi-2.pdf', 'triggers/planeacion-multi-2.pdf', 'application/pdf', 100),
            (%1$L, %2$L, %3$L, 'planeacion-multi-3.pdf', 'triggers/planeacion-multi-3.pdf', 'application/pdf', 100)
        $$,
        (SELECT worker_id FROM worker_documents_trigger_ids),
        (SELECT semester_type_id FROM worker_documents_trigger_ids),
        (SELECT semester_id FROM worker_documents_trigger_ids)
    ),
    'Docencia / Planeación semestral admits a 2nd and 3rd file for the same worker/semester'
);
SELECT is(
    (SELECT count(*)::int FROM public.worker_documents WHERE storage_path LIKE 'triggers/planeacion-multi-%'),
    3,
    'all 3 Planeación semestral documents persist'
);

SELECT lives_ok(
    format(
        $$
        INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
        VALUES
            (%1$L, %2$L, %3$L, 'rubricas-multi-1.pdf', 'triggers/rubricas-multi-1.pdf', 'application/pdf', 100),
            (%1$L, %2$L, %3$L, 'rubricas-multi-2.pdf', 'triggers/rubricas-multi-2.pdf', 'application/pdf', 100),
            (%1$L, %2$L, %3$L, 'rubricas-multi-3.pdf', 'triggers/rubricas-multi-3.pdf', 'application/pdf', 100)
        $$,
        (SELECT worker_id FROM worker_documents_trigger_ids),
        (SELECT rubricas_type_id FROM worker_documents_trigger_ids),
        (SELECT semester_id FROM worker_documents_trigger_ids)
    ),
    'Docencia / Rúbricas admits a 2nd and 3rd file for the same worker/semester'
);
SELECT is(
    (SELECT count(*)::int FROM public.worker_documents WHERE storage_path LIKE 'triggers/rubricas-multi-%'),
    3,
    'all 3 Rúbricas documents persist'
);

SELECT lives_ok(
    format(
        $$
        INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
        VALUES
            (%1$L, %2$L, %3$L, 'cotejo-multi-1.pdf', 'triggers/cotejo-multi-1.pdf', 'application/pdf', 100),
            (%1$L, %2$L, %3$L, 'cotejo-multi-2.pdf', 'triggers/cotejo-multi-2.pdf', 'application/pdf', 100),
            (%1$L, %2$L, %3$L, 'cotejo-multi-3.pdf', 'triggers/cotejo-multi-3.pdf', 'application/pdf', 100)
        $$,
        (SELECT worker_id FROM worker_documents_trigger_ids),
        (SELECT listas_cotejo_type_id FROM worker_documents_trigger_ids),
        (SELECT semester_id FROM worker_documents_trigger_ids)
    ),
    'Docencia / Listas de cotejo admits a 2nd and 3rd file for the same worker/semester'
);
SELECT is(
    (SELECT count(*)::int FROM public.worker_documents WHERE storage_path LIKE 'triggers/cotejo-multi-%'),
    3,
    'all 3 Listas de cotejo documents persist'
);

SELECT lives_ok(
    format(
        $$
        INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
        VALUES
            (%1$L, %2$L, %3$L, 'asistencia-multi-1.pdf', 'triggers/asistencia-multi-1.pdf', 'application/pdf', 100),
            (%1$L, %2$L, %3$L, 'asistencia-multi-2.pdf', 'triggers/asistencia-multi-2.pdf', 'application/pdf', 100),
            (%1$L, %2$L, %3$L, 'asistencia-multi-3.pdf', 'triggers/asistencia-multi-3.pdf', 'application/pdf', 100)
        $$,
        (SELECT worker_id FROM worker_documents_trigger_ids),
        (SELECT listas_asistencia_type_id FROM worker_documents_trigger_ids),
        (SELECT semester_id FROM worker_documents_trigger_ids)
    ),
    'Docencia / Listas de asistencia admits a 2nd and 3rd file for the same worker/semester'
);
SELECT is(
    (SELECT count(*)::int FROM public.worker_documents WHERE storage_path LIKE 'triggers/asistencia-multi-%'),
    3,
    'all 3 Listas de asistencia documents persist'
);

SELECT lives_ok(
    format(
        $$
        INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
        VALUES
            (%1$L, %2$L, %3$L, 'actas-multi-1.pdf', 'triggers/actas-multi-1.pdf', 'application/pdf', 100),
            (%1$L, %2$L, %3$L, 'actas-multi-2.pdf', 'triggers/actas-multi-2.pdf', 'application/pdf', 100),
            (%1$L, %2$L, %3$L, 'actas-multi-3.pdf', 'triggers/actas-multi-3.pdf', 'application/pdf', 100)
        $$,
        (SELECT worker_id FROM worker_documents_trigger_ids),
        (SELECT actas_evaluacion_type_id FROM worker_documents_trigger_ids),
        (SELECT semester_id FROM worker_documents_trigger_ids)
    ),
    'Docencia / Actas de evaluación admits a 2nd and 3rd file for the same worker/semester'
);
SELECT is(
    (SELECT count(*)::int FROM public.worker_documents WHERE storage_path LIKE 'triggers/actas-multi-%'),
    3,
    'all 3 Actas de evaluación documents persist'
);

SELECT lives_ok(
    format(
        $$
        INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
        VALUES
            (%1$L, %2$L, %3$L, 'concentrado-multi-1.pdf', 'triggers/concentrado-multi-1.pdf', 'application/pdf', 100),
            (%1$L, %2$L, %3$L, 'concentrado-multi-2.pdf', 'triggers/concentrado-multi-2.pdf', 'application/pdf', 100),
            (%1$L, %2$L, %3$L, 'concentrado-multi-3.pdf', 'triggers/concentrado-multi-3.pdf', 'application/pdf', 100)
        $$,
        (SELECT worker_id FROM worker_documents_trigger_ids),
        (SELECT concentrado_type_id FROM worker_documents_trigger_ids),
        (SELECT semester_id FROM worker_documents_trigger_ids)
    ),
    'Docencia / Concentrado de calificaciones finales admits a 2nd and 3rd file for the same worker/semester'
);
SELECT is(
    (SELECT count(*)::int FROM public.worker_documents WHERE storage_path LIKE 'triggers/concentrado-multi-%'),
    3,
    'all 3 Concentrado de calificaciones finales documents persist'
);

SELECT lives_ok(
    $$
    DELETE FROM public.worker_documents
    WHERE storage_path = 'triggers/curp-a.pdf';

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
        permanent_type_id,
        NULL,
        'curp-replacement.pdf',
        'triggers/curp-replacement.pdf',
        'application/pdf',
        100
    FROM worker_documents_trigger_ids
    $$,
    'delete-old-row-then-insert-new replacement pattern succeeds'
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
        evidence_type_id,
        semester_id,
        'empty.pdf',
        'triggers/empty.pdf',
        'application/pdf',
        0
    FROM worker_documents_trigger_ids
    $$,
    '23514',
    'new row for relation "worker_documents" violates check constraint "worker_documents_file_size_check"',
    'file_size = 0 is rejected'
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
        evidence_type_id,
        semester_id,
        'too-large.pdf',
        'triggers/too-large.pdf',
        'application/pdf',
        10485761
    FROM worker_documents_trigger_ids
    $$,
    '23514',
    'new row for relation "worker_documents" violates check constraint "worker_documents_file_size_check"',
    'file_size > 10485760 is rejected'
);

-- enforce_active_worker_document_type (design.md Decision 3): fires
-- alphabetically before the two pre-existing triggers on the same
-- BEFORE INSERT/UPDATE timing (enforce_active_... < enforce_single_... <
-- enforce_worker_document_scope_...), so it is the one that actually
-- raises for an inactive or nonexistent type in every case below.

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
        999999999,
        semester_id,
        'nonexistent-type.pdf',
        'triggers/nonexistent-type.pdf',
        'application/pdf',
        100
    FROM worker_documents_trigger_ids
    $$,
    'P0001',
    NULL,
    'insert against a nonexistent document_type_id is rejected'
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
        inactive_type_id,
        semester_id,
        'inactive-type.pdf',
        'triggers/inactive-type.pdf',
        'application/pdf',
        100
    FROM worker_documents_trigger_ids
    $$,
    'WDT01',
    NULL,
    'insert against an inactive document_type_id is rejected with WDT01'
);

-- A fresh row against an active type, used by the two UPDATE tests below.
INSERT INTO public.worker_documents (
    worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size
)
SELECT worker_id, semester_type_id, semester_id, 'planeacion-update-fixture.pdf', 'triggers/planeacion-update-fixture.pdf', 'application/pdf', 100
FROM worker_documents_trigger_ids;

SELECT throws_ok(
    $$
    UPDATE public.worker_documents
    SET document_type_id = (SELECT inactive_type_id FROM worker_documents_trigger_ids)
    WHERE storage_path = 'triggers/planeacion-update-fixture.pdf'
    $$,
    'WDT01',
    NULL,
    'an update that changes document_type_id to an inactive type is rejected with WDT01'
);

-- Retire the fixture row's own type in place, then confirm an unrelated
-- UPDATE (document_type_id unchanged) still succeeds -- the specific
-- narrowing design.md Decision 3 requires.
UPDATE public.worker_document_types
SET is_active = false
WHERE id = (SELECT semester_type_id FROM worker_documents_trigger_ids);

SELECT lives_ok(
    $$
    UPDATE public.worker_documents
    SET file_name = 'planeacion-update-fixture-renamed.pdf'
    WHERE storage_path = 'triggers/planeacion-update-fixture.pdf'
    $$,
    'an update that leaves document_type_id unchanged succeeds even when that type is now inactive'
);

SELECT * FROM finish();

ROLLBACK;
