BEGIN;

SET search_path = public, extensions;

-- Behavioral coverage of
-- 20260721020000_add_worker_document_type_description.sql and
-- 20260721030000_update_advising_tutoring_document_requirements.sql:
-- Asesoría / Informes and Tutoría / Relación de estudiantes tutorados
-- retired (never deleted); Asesoría / Control de asesorías and
-- Documentos de titulación carry their new editorial descriptions;
-- Tutoría / Plan de Trabajo exists, active, single-file, sorted first with
-- no ties; every other category/type is untouched.

SELECT plan(25);

SELECT "id" AS asesoria_id FROM public.worker_document_categories WHERE "name" = 'Asesoría' \gset
SELECT "id" AS tutoria_id FROM public.worker_document_categories WHERE "name" = 'Tutoría' \gset

-- 1-2: Informes and Relación de estudiantes tutorados are inactive, not
-- deleted -- the row itself still exists (proves is_active = false, never
-- a DELETE).
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_document_types
        WHERE category_id = :asesoria_id AND name = 'Informes' AND is_active = false
    ),
    'Asesoría / Informes exists and is inactive'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_document_types
        WHERE category_id = :tutoria_id AND name = 'Relación de estudiantes tutorados' AND is_active = false
    ),
    'Tutoría / Relación de estudiantes tutorados exists and is inactive'
);

-- 3-4: the two new editorial descriptions.
SELECT is(
    (
        SELECT description FROM public.worker_document_types
        WHERE category_id = :asesoria_id AND name = 'Control de asesorías'
    ),
    'Bitácoras',
    'Asesoría / Control de asesorías has description = ''Bitácoras'''
);

SELECT is(
    (
        SELECT description FROM public.worker_document_types
        WHERE category_id = :asesoria_id AND name = 'Documentos de titulación'
    ),
    'Dictamen',
    'Asesoría / Documentos de titulación has description = ''Dictamen'''
);

-- 5: Control de asesorías and Documentos de titulación stayed single-file
-- and active -- only their description changed.
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_document_types
        WHERE category_id = :asesoria_id AND name = 'Control de asesorías'
            AND is_active = true AND allows_multiple = false
    )
    AND EXISTS (
        SELECT 1 FROM public.worker_document_types
        WHERE category_id = :asesoria_id AND name = 'Documentos de titulación'
            AND is_active = true AND allows_multiple = false
    ),
    'Control de asesorías and Documentos de titulación remain active and single-file (only description changed)'
);

-- 6-7: Plan de Trabajo exists with the expected shape.
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_document_types
        WHERE category_id = :tutoria_id AND name = 'Plan de Trabajo'
            AND is_active = true AND allows_multiple = false
    ),
    'Tutoría / Plan de Trabajo exists, is active, and does not allow multiple files'
);

SELECT ok(
    (
        SELECT sort_order FROM public.worker_document_types
        WHERE category_id = :tutoria_id AND name = 'Plan de Trabajo'
    ) < (
        SELECT min(sort_order) FROM public.worker_document_types
        WHERE category_id = :tutoria_id AND name <> 'Plan de Trabajo'
    ),
    'Tutoría / Plan de Trabajo has a strictly lower sort_order than every other Tutoría type (sorts first)'
);

-- 8: no two Tutoría types share a sort_order (no unexpected ties anywhere
-- in the category, not just around Plan de Trabajo).
SELECT is(
    (
        SELECT count(*) FROM public.worker_document_types
        WHERE category_id = :tutoria_id
    ),
    (
        SELECT count(DISTINCT sort_order) FROM public.worker_document_types
        WHERE category_id = :tutoria_id
    ),
    'every Tutoría document type has a distinct sort_order (no ties)'
);

-- 9: Tutoría now has exactly 6 types (5 seeded + Plan de Trabajo); Asesoría
-- keeps its original 4.
SELECT is(
    (SELECT count(*) FROM public.worker_document_types WHERE category_id = :tutoria_id),
    6::bigint,
    'Tutoría has exactly 6 document types after the migration'
);

SELECT is(
    (SELECT count(*) FROM public.worker_document_types WHERE category_id = :asesoria_id),
    4::bigint,
    'Asesoría still has exactly 4 document types (none added or removed)'
);

-- 10: every other Tutoría/Asesoría type is untouched -- name, is_active,
-- allows_multiple, and description (still NULL) all exactly as seeded.
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_document_types
        WHERE category_id = :tutoria_id AND name = 'Canalizaciones'
            AND is_active = true AND allows_multiple = false AND description IS NULL
    )
    AND EXISTS (
        SELECT 1 FROM public.worker_document_types
        WHERE category_id = :tutoria_id AND name = 'Evidencias de actividades'
            AND is_active = true AND allows_multiple = true AND description IS NULL
    )
    AND EXISTS (
        SELECT 1 FROM public.worker_document_types
        WHERE category_id = :tutoria_id AND name = 'Listas de asistencia'
            AND is_active = true AND allows_multiple = false AND description IS NULL
    )
    AND EXISTS (
        SELECT 1 FROM public.worker_document_types
        WHERE category_id = :tutoria_id AND name = 'Informes de tutoría'
            AND is_active = true AND allows_multiple = false AND description IS NULL
    )
    AND EXISTS (
        SELECT 1 FROM public.worker_document_types
        WHERE category_id = :asesoria_id AND name = 'Evidencias'
            AND is_active = true AND allows_multiple = true AND description IS NULL
    ),
    'every other Tutoría/Asesoría document type is unchanged'
);

-- 11: no category other than Asesoría/Tutoría was touched -- Docencia,
-- Investigación, and Datos personales keep exactly their prior row counts
-- and active-type counts (structurally guaranteed by the migration's
-- id-scoped UPDATE/INSERT statements; asserted here as the observable
-- positive fact, same discipline as
-- 20260721010000_docencia_active_types_allow_multiple.sql's own suite).
SELECT is(
    (
        SELECT count(*) FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Docencia'
    ),
    9::bigint,
    'Docencia''s document type count is unaffected'
);

SELECT is(
    (
        SELECT count(*) FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Investigación'
    ),
    5::bigint,
    'Investigación''s document type count is unaffected'
);

SELECT is(
    (
        SELECT count(*) FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Datos personales'
    ),
    6::bigint,
    'Datos personales'' document type count is unaffected'
);

-- 12: a retired type's row is never deleted, and a document already on
-- file against it (simulated: temporarily reactivated to insert, exactly
-- as if uploaded before this migration retired it, then retired again)
-- remains a valid, readable, non-orphaned reference afterwards -- no
-- historical worker_documents row is ever lost or unjoinable.
-- Asesoría is a semester-scoped category (enforce_worker_document_scope
-- requires a non-null semester_id for it), so the fixture needs a real
-- semester row, unlike the permanent-scope fixtures elsewhere in this
-- suite.
CREATE TEMP TABLE advising_tutoring_history_ids AS
WITH worker_insert AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Advising History Worker', 'QA', 1)
    RETURNING id
),
semester_insert AS (
    INSERT INTO public.semesters (semester, school_year)
    VALUES ('QA Advising History', '2026-2027')
    RETURNING id
)
SELECT worker_insert.id AS worker_id, semester_insert.id AS semester_id
FROM worker_insert, semester_insert;

SELECT worker_id, semester_id FROM advising_tutoring_history_ids \gset

UPDATE public.worker_document_types SET is_active = true
WHERE category_id = :asesoria_id AND name = 'Informes';

INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
SELECT
    :worker_id,
    (SELECT id FROM public.worker_document_types WHERE category_id = :asesoria_id AND name = 'Informes'),
    :semester_id,
    'informe-historico.pdf',
    'advising-history/informe-historico.pdf',
    'application/pdf',
    100;

UPDATE public.worker_document_types SET is_active = false
WHERE category_id = :asesoria_id AND name = 'Informes';

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_documents
        JOIN public.worker_document_types
            ON worker_document_types.id = worker_documents.document_type_id
        WHERE worker_documents.storage_path = 'advising-history/informe-historico.pdf'
            AND worker_document_types.name = 'Informes'
            AND worker_document_types.is_active = false
    ),
    'a historical document uploaded before retirement still joins correctly to the now-inactive Informes type'
);

-- 13: re-retiring Informes (undoing the temporary reactivation above)
-- didn't touch the historical document row itself.
SELECT is(
    (
        SELECT count(*) FROM public.worker_documents
        WHERE storage_path = 'advising-history/informe-historico.pdf'
    ),
    1::bigint,
    'the historical document row is untouched by the type''s retirement'
);

-- 14: new uploads against the now-inactive Informes type are still
-- rejected (enforce_active_worker_document_type is generic, unaffected by
-- this migration) -- retirement blocks new uploads without disturbing the
-- historical row asserted above.
SELECT throws_ok(
    format(
        $$
        INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
        VALUES (%L, %L, %L, 'nuevo-informe.pdf', 'advising-history/nuevo-informe.pdf', 'application/pdf', 100)
        $$,
        :worker_id,
        (SELECT id FROM public.worker_document_types WHERE category_id = :asesoria_id AND name = 'Informes'),
        :semester_id
    ),
    'WDT01',
    NULL,
    'a new upload against the retired Informes type is still rejected'
);

-- 15-18: a purpose-built boundary reproduction of "retiring a type never
-- deletes or orphans a document already on file" -- using an ISOLATED
-- fixture type (never the real Informes/Relación de estudiantes tutorados
-- rows, and never the production migration file itself, which is not
-- modified or re-run to accommodate this test). The document is inserted
-- while the fixture type is still active -- the same real-world sequence
-- an actual historical document follows -- and only the retirement
-- transition's exact SQL shape (a plain `is_active = false` UPDATE by id)
-- is reproduced afterward.
CREATE TEMP TABLE retirement_boundary_ids AS
WITH fixture_type AS (
    INSERT INTO public.worker_document_types (category_id, name, is_active, allows_multiple, sort_order)
    SELECT id, 'QA Retirement Boundary Type', true, false, 999
    FROM public.worker_document_categories
    WHERE name = 'Asesoría'
    RETURNING id
),
fixture_worker AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Retirement Boundary Worker', 'QA', 1)
    RETURNING id
),
fixture_semester AS (
    INSERT INTO public.semesters (semester, school_year)
    VALUES ('QA Retirement Boundary', '2026-2027')
    RETURNING id
)
SELECT fixture_type.id AS type_id, fixture_worker.id AS worker_id, fixture_semester.id AS semester_id
FROM fixture_type, fixture_worker, fixture_semester;

SELECT type_id, worker_id, semester_id FROM retirement_boundary_ids \gset

CREATE TEMP TABLE retirement_boundary_doc AS
WITH doc_insert AS (
    INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
    SELECT worker_id, type_id, semester_id, 'historico-frontera.pdf', 'retirement-boundary/historico-frontera.pdf', 'application/pdf', 100
    FROM retirement_boundary_ids
    RETURNING id
)
SELECT id AS doc_id FROM doc_insert;

SELECT doc_id FROM retirement_boundary_doc \gset

SELECT is(
    (SELECT count(*) FROM public.worker_documents WHERE id = :doc_id),
    1::bigint,
    'boundary reproduction: the fixture document exists before retirement (baseline)'
);

-- Reproduction of the retirement transition only -- not the migration file.
UPDATE public.worker_document_types
SET is_active = false
WHERE id = :type_id;

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_documents
        WHERE id = :doc_id AND storage_path = 'retirement-boundary/historico-frontera.pdf'
    ),
    'boundary reproduction: the exact same worker_documents row (same id) still exists after the type is retired -- no DELETE, no cascade'
);

SELECT is(
    (SELECT count(*) FROM public.worker_documents WHERE id = :doc_id),
    1::bigint,
    'boundary reproduction: the row count for this id is still exactly 1 -- retirement never duplicates or removes it'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_documents
        JOIN public.worker_document_types
            ON worker_document_types.id = worker_documents.document_type_id
        WHERE worker_documents.id = :doc_id AND worker_document_types.is_active = false
    ),
    'boundary reproduction: the document is still consultable by id and correctly joins to its now-inactive type'
);

-- 19-22: the documented "not designed to be re-run" contract, proven
-- directly against the real, already-migrated catalog -- not just
-- asserted in a comment. The reproduction below is FAITHFUL to the
-- production migration's actual precondition-checking order: category
-- resolution, then every type precondition in the exact sequence the
-- migration itself checks them. Run against an already-migrated catalog,
-- this correctly raises at the very FIRST precondition actually reached
-- -- Asesoría / Informes no longer being active (checked before either
-- description precondition) -- never a later one. The migration file
-- itself is never executed literally nor modified to accommodate this
-- test; this is a documented, hand-maintained reproduction of its
-- precondition logic only (no mutation statements -- those are
-- genuinely unreachable on a second run too, since the exception fires
-- before them).
SELECT id AS informes_id FROM public.worker_document_types
WHERE category_id = :asesoria_id AND name = 'Informes' \gset

SELECT
    'Asesoría / Informes (id ' || :informes_id || ') is not active; refusing to proceed (already retired, or unexpected catalog state)'
    AS expected_message \gset

-- Snapshot of every row this migration touches (or would touch on a
-- second attempt), captured before the reproduction runs.
CREATE TEMP TABLE second_run_snapshot AS
SELECT id, category_id, name, is_active, allows_multiple, sort_order, description
FROM public.worker_document_types
WHERE (category_id = :asesoria_id AND name IN ('Informes', 'Control de asesorías', 'Documentos de titulación'))
   OR (category_id = :tutoria_id AND name IN ('Relación de estudiantes tutorados', 'Plan de Trabajo'));

SELECT is(
    (SELECT count(*) FROM second_run_snapshot),
    5::bigint,
    'second-run snapshot captured all 5 relevant rows (baseline)'
);

SELECT throws_ok(
    $$
    DO $repro$
    DECLARE
        v_asesoria_id bigint;
        v_tutoria_id bigint;
        v_informes_id bigint;
        v_relacion_id bigint;
        v_control_asesorias_id bigint;
        v_documentos_titulacion_id bigint;
    BEGIN
        SELECT "id" INTO v_asesoria_id
        FROM "public"."worker_document_categories"
        WHERE "name" = 'Asesoría';

        IF v_asesoria_id IS NULL THEN
            RAISE EXCEPTION 'Asesoría category not found; refusing to apply the advising/tutoring document requirements migration';
        END IF;

        SELECT "id" INTO v_tutoria_id
        FROM "public"."worker_document_categories"
        WHERE "name" = 'Tutoría';

        IF v_tutoria_id IS NULL THEN
            RAISE EXCEPTION 'Tutoría category not found; refusing to apply the advising/tutoring document requirements migration';
        END IF;

        SELECT "id" INTO v_informes_id
        FROM "public"."worker_document_types"
        WHERE "category_id" = v_asesoria_id AND "name" = 'Informes';

        IF v_informes_id IS NULL THEN
            RAISE EXCEPTION 'Asesoría / Informes not found; refusing to proceed (unexpected catalog state)';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM "public"."worker_document_types"
            WHERE "id" = v_informes_id AND "is_active" = true
        ) THEN
            RAISE EXCEPTION 'Asesoría / Informes (id %) is not active; refusing to proceed (already retired, or unexpected catalog state)', v_informes_id;
        END IF;

        SELECT "id" INTO v_relacion_id
        FROM "public"."worker_document_types"
        WHERE "category_id" = v_tutoria_id AND "name" = 'Relación de estudiantes tutorados';

        IF v_relacion_id IS NULL THEN
            RAISE EXCEPTION 'Tutoría / Relación de estudiantes tutorados not found; refusing to proceed (unexpected catalog state)';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM "public"."worker_document_types"
            WHERE "id" = v_relacion_id AND "is_active" = true
        ) THEN
            RAISE EXCEPTION 'Tutoría / Relación de estudiantes tutorados (id %) is not active; refusing to proceed (already retired, or unexpected catalog state)', v_relacion_id;
        END IF;

        SELECT "id" INTO v_control_asesorias_id
        FROM "public"."worker_document_types"
        WHERE "category_id" = v_asesoria_id AND "name" = 'Control de asesorías';

        IF v_control_asesorias_id IS NULL THEN
            RAISE EXCEPTION 'Asesoría / Control de asesorías not found; refusing to proceed (unexpected catalog state)';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM "public"."worker_document_types"
            WHERE "id" = v_control_asesorias_id AND "description" IS NULL
        ) THEN
            RAISE EXCEPTION 'Asesoría / Control de asesorías (id %) already has a description; refusing to proceed (this migration may have already run)', v_control_asesorias_id;
        END IF;

        SELECT "id" INTO v_documentos_titulacion_id
        FROM "public"."worker_document_types"
        WHERE "category_id" = v_asesoria_id AND "name" = 'Documentos de titulación';

        IF v_documentos_titulacion_id IS NULL THEN
            RAISE EXCEPTION 'Asesoría / Documentos de titulación not found; refusing to proceed (unexpected catalog state)';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM "public"."worker_document_types"
            WHERE "id" = v_documentos_titulacion_id AND "description" IS NULL
        ) THEN
            RAISE EXCEPTION 'Asesoría / Documentos de titulación (id %) already has a description; refusing to proceed (this migration may have already run)', v_documentos_titulacion_id;
        END IF;

        IF EXISTS (
            SELECT 1 FROM "public"."worker_document_types"
            WHERE "category_id" = v_tutoria_id AND "name" = 'Plan de Trabajo'
        ) THEN
            RAISE EXCEPTION 'Tutoría / Plan de Trabajo already exists; refusing to proceed (this migration may have already run)';
        END IF;
    END;
    $repro$;
    $$,
    'P0001',
    :'expected_message',
    'a second attempt against the already-migrated catalog fails at the FIRST precondition actually reached in program order -- Asesoría / Informes already inactive -- with the exact documented diagnostic'
);

SELECT is(
    (
        SELECT count(*) FROM second_run_snapshot snap
        JOIN public.worker_document_types t ON t.id = snap.id
        WHERE t.name = snap.name
            AND t.is_active = snap.is_active
            AND t.allows_multiple = snap.allows_multiple
            AND t.sort_order = snap.sort_order
            AND t.description IS NOT DISTINCT FROM snap.description
    ),
    5::bigint,
    'every snapshotted row (Informes, Relación de estudiantes tutorados, Control de asesorías, Documentos de titulación, Plan de Trabajo) is byte-for-byte unchanged after the failed reproduction -- no partial mutation of descriptions, is_active, or sort_order'
);

SELECT is(
    (
        SELECT count(*) FROM public.worker_document_types
        WHERE category_id = :tutoria_id AND name = 'Plan de Trabajo'
    ),
    1::bigint,
    'no second Tutoría / Plan de Trabajo was inserted by the failed reproduction'
);

SELECT * FROM finish();

ROLLBACK;
