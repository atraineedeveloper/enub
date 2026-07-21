DO $$
DECLARE
    v_asesoria_id bigint;
    v_tutoria_id bigint;
    v_informes_id bigint;
    v_relacion_id bigint;
    v_control_asesorias_id bigint;
    v_documentos_titulacion_id bigint;
    v_new_sort_order smallint;
    v_plan_trabajo_id bigint;
    v_min_other_sort_order smallint;
BEGIN
    -- Three DISTINCT lock families are in play in this migration, each
    -- with its own real responsibility -- none of them substitutes for
    -- another:
    --
    -- 1. This advisory transaction lock is COOPERATIVE ONLY: it serializes
    --    this migration against another concurrent attempt to run this
    --    SAME migration (a real, if narrow, possibility -- e.g. a second
    --    `supabase db reset`/deploy invoked before the first finished). It
    --    does NOT exclude, block, or even see ordinary readers/writers of
    --    worker_document_categories/worker_document_types that don't also
    --    take this same advisory lock -- pg_advisory_xact_lock only
    --    serializes against OTHER callers of pg_advisory_xact_lock with
    --    the identical key; a plain UPDATE from application code is
    --    entirely unaffected by it. Asserting otherwise would be false.
    -- 2. The LOCK TABLE statement immediately below is what actually
    --    excludes concurrent writers: SHARE ROW EXCLUSIVE still permits
    --    ordinary reads (SELECT) against these two tables from any other
    --    session, but blocks any other session's INSERT/UPDATE/DELETE (and
    --    any other SHARE ROW EXCLUSIVE or stronger lock) against them
    --    until this transaction commits or rolls back -- this is the lock
    --    that actually protects category resolution, every precondition
    --    read, the min(sort_order) computation, the description updates,
    --    the retirements, the insertion, and the postconditions from a
    --    genuinely concurrent writer (e.g. an administrator editing the
    --    catalog through some future admin UI, or a different migration
    --    applied out of order) mutating the same rows mid-transaction.
    -- 3. The per-type "lifecycle" advisory locks acquired further below
    --    (identical namespace/construction to
    --    enforce_active_worker_document_type and
    --    replace_worker_document_metadata) are a SEPARATE, pre-existing
    --    coordination protocol specifically for retiring a document type
    --    against a concurrent upload/replacement attempt on that same
    --    type -- unrelated to catalog-table writes, and already
    --    established by 20260716013947_retire_and_rename_docencia_document_types.sql.
    --
    -- Fixed acquisition order (categories before types) matches the order
    -- these tables are otherwise touched in this block, reducing deadlock
    -- risk against any other transaction that also locks both.
    PERFORM "pg_advisory_xact_lock"(
        "hashtextextended"('worker_document_catalog:update_advising_tutoring_requirements', 0)
    );

    LOCK TABLE "public"."worker_document_categories",
               "public"."worker_document_types"
        IN SHARE ROW EXCLUSIVE MODE;

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

    -- Preconditions: every row this migration touches must be found in
    -- exactly the state expected BEFORE this migration has ever run. Each
    -- check below fails closed with a controlled diagnostic on ANY drift --
    -- a missing type, an unexpected prior retirement, or a description
    -- already set (the signal that this migration already ran once) --
    -- rather than silently reapplying or updating the wrong row. This
    -- migration is intentionally NOT designed to be re-run: a second
    -- execution against an already-migrated catalog fails here, at the
    -- FIRST precondition checked in program order that no longer holds --
    -- which is the very next check below (Asesoría / Informes no longer
    -- being active, since retirement is checked before the description
    -- preconditions further down), not as a silent no-op.
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

    -- Retire Informes and Relación de estudiantes tutorados. Same shared
    -- lifecycle advisory lock (same namespace/construction as
    -- enforce_active_worker_document_type and
    -- replace_worker_document_metadata) acquired before each mutation, so
    -- each UPDATE serializes against a concurrent upload/replacement
    -- attempt against that same type rather than racing it -- identical
    -- pattern to
    -- 20260716013947_retire_and_rename_docencia_document_types.sql.
    -- Deactivating only (never deleting) preserves every existing
    -- worker_documents row referencing these types intact.
    PERFORM "pg_advisory_xact_lock"(
        "hashtextextended"('worker_document_type:lifecycle:' || v_informes_id::text, 0)
    );

    UPDATE "public"."worker_document_types"
    SET "is_active" = false
    WHERE "id" = v_informes_id;

    PERFORM "pg_advisory_xact_lock"(
        "hashtextextended"('worker_document_type:lifecycle:' || v_relacion_id::text, 0)
    );

    UPDATE "public"."worker_document_types"
    SET "is_active" = false
    WHERE "id" = v_relacion_id;

    -- Editorial descriptions -- metadata only, no lifecycle/upload-path
    -- implication, so no per-type advisory lock is needed for these two
    -- (already covered by the table-level SHARE ROW EXCLUSIVE lock above).
    UPDATE "public"."worker_document_types"
    SET "description" = 'Bitácoras'
    WHERE "id" = v_control_asesorias_id;

    UPDATE "public"."worker_document_types"
    SET "description" = 'Dictamen'
    WHERE "id" = v_documentos_titulacion_id;

    -- New Tutoría type, sorted first. Computed as 5 below the current
    -- minimum sort_order in Tutoría (today 10, "Relación de estudiantes
    -- tutorados") rather than a hard-coded literal, and rather than
    -- renumbering every existing Tutoría row -- minimal footprint, no ties,
    -- deterministic, resilient to the exact current values shifting before
    -- this migration is applied.
    SELECT min("sort_order") - 5 INTO v_new_sort_order
    FROM "public"."worker_document_types"
    WHERE "category_id" = v_tutoria_id;

    INSERT INTO "public"."worker_document_types" (
        "category_id", "name", "is_active", "allows_multiple", "sort_order"
    )
    VALUES (
        v_tutoria_id, 'Plan de Trabajo', true, false, v_new_sort_order
    )
    RETURNING "id" INTO v_plan_trabajo_id;

    -- Postconditions: verify every effect above landed exactly as
    -- intended, not merely that no exception was raised.
    IF NOT EXISTS (
        SELECT 1 FROM "public"."worker_document_types"
        WHERE "id" = v_informes_id AND "is_active" = false
    ) THEN
        RAISE EXCEPTION 'Postcondition failed: Asesoría / Informes (id %) is not inactive; refusing to proceed', v_informes_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM "public"."worker_document_types"
        WHERE "id" = v_relacion_id AND "is_active" = false
    ) THEN
        RAISE EXCEPTION 'Postcondition failed: Tutoría / Relación de estudiantes tutorados (id %) is not inactive; refusing to proceed', v_relacion_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM "public"."worker_document_types"
        WHERE "id" = v_control_asesorias_id AND "description" = 'Bitácoras'
    ) THEN
        RAISE EXCEPTION 'Postcondition failed: Asesoría / Control de asesorías (id %) does not have description = ''Bitácoras''; refusing to proceed', v_control_asesorias_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM "public"."worker_document_types"
        WHERE "id" = v_documentos_titulacion_id AND "description" = 'Dictamen'
    ) THEN
        RAISE EXCEPTION 'Postcondition failed: Asesoría / Documentos de titulación (id %) does not have description = ''Dictamen''; refusing to proceed', v_documentos_titulacion_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM "public"."worker_document_types"
        WHERE "id" = v_plan_trabajo_id
            AND "category_id" = v_tutoria_id
            AND "is_active" = true
            AND "allows_multiple" = false
    ) THEN
        RAISE EXCEPTION 'Postcondition failed: Tutoría / Plan de Trabajo (id %) does not have the expected category/is_active/allows_multiple; refusing to proceed', v_plan_trabajo_id;
    END IF;

    -- Plan de Trabajo's sort_order must be strictly less than every other
    -- Tutoría type's sort_order -- proves "first, no ties" directly,
    -- rather than merely trusting the computed value above.
    SELECT min("sort_order") INTO v_min_other_sort_order
    FROM "public"."worker_document_types"
    WHERE "category_id" = v_tutoria_id AND "id" <> v_plan_trabajo_id;

    IF NOT (v_new_sort_order < v_min_other_sort_order) THEN
        RAISE EXCEPTION 'Postcondition failed: Tutoría / Plan de Trabajo sort_order (%) is not strictly less than every other Tutoría type''s sort_order (min %); refusing to proceed', v_new_sort_order, v_min_other_sort_order;
    END IF;

    -- Scope: every UPDATE/INSERT above is scoped by an id or category_id
    -- resolved earlier in this block, so it is structurally impossible for
    -- this migration to have touched Docencia, Investigación, Datos
    -- personales, or any row in Asesoría/Tutoría other than the four named
    -- above -- guaranteed by construction, not by a runtime snapshot-diff
    -- (same rationale as
    -- 20260721010000_docencia_active_types_allow_multiple.sql's Decision 2).
END;
$$;
