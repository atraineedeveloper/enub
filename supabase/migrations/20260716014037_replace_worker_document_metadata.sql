CREATE OR REPLACE FUNCTION "public"."replace_worker_document_metadata"(
    "p_worker_id" bigint,
    "p_document_type_id" bigint,
    "p_semester_id" bigint,
    "p_file_name" text,
    "p_storage_path" text,
    "p_mime_type" text,
    "p_file_size" bigint
)
RETURNS TABLE(
    -- Every output column is prefixed new_/old_ so none collides with an
    -- actual worker_documents column name -- RETURNS TABLE column names
    -- become implicitly-declared PL/pgSQL variables in the function body,
    -- and an unprefixed name like "id" would make every bare `WHERE id =`
    -- inside this function ambiguous between that variable and the real
    -- table column.
    "new_id" bigint,
    "new_worker_id" bigint,
    "new_document_type_id" bigint,
    "new_semester_id" bigint,
    "new_file_name" text,
    "new_storage_path" text,
    "new_mime_type" text,
    "new_file_size" bigint,
    "new_uploaded_by" uuid,
    "new_created_at" timestamp with time zone,
    "old_storage_paths" text[]
)
LANGUAGE "plpgsql"
SECURITY INVOKER
SET "search_path" = ''
AS $$
DECLARE
    v_is_active boolean;
    v_allows_multiple boolean;
    v_old_row record;
    v_old_ids bigint[] := ARRAY[]::bigint[];
    v_old_paths text[] := ARRAY[]::text[];
    v_new_row "public"."worker_documents"%ROWTYPE;
BEGIN
    -- 1. Validate input.
    IF p_worker_id IS NULL OR p_document_type_id IS NULL
        OR p_file_name IS NULL OR p_storage_path IS NULL
        OR p_mime_type IS NULL OR p_file_size IS NULL THEN
        RAISE EXCEPTION 'Missing required replacement metadata field';
    END IF;

    -- 2. Acquire the shared lifecycle advisory lock for this document type
    -- BEFORE reading it -- the identical namespace/construction used by
    -- enforce_active_worker_document_type and the retirement migration, so
    -- this call and a concurrent retirement transaction serialize against
    -- each other rather than racing. This is a transaction-level advisory
    -- lock (released automatically at COMMIT/ROLLBACK), never a session
    -- lock, and it is an operation-serialization mechanism only -- it
    -- grants no authorization and implies no row lock.
    PERFORM "pg_advisory_xact_lock"(
        "hashtextextended"(
            'worker_document_type:lifecycle:' || p_document_type_id::text,
            0
        )
    );

    -- 3. Load the relevant document type. A plain SELECT, not FOR SHARE:
    -- worker_document_types has only a SELECT-only RLS policy (retirement/
    -- rename is applied via migration, never through a client-facing RLS
    -- policy), and Postgres silently excludes rows from a FOR UPDATE/FOR
    -- SHARE locking clause when no policy applicable to that lock exists --
    -- a FOR SHARE lock here would silently see zero rows for every non-
    -- superuser caller. A plain read is sufficient once the advisory lock
    -- above is held: no concurrent retirement transaction can be
    -- mid-flight on this same document type while this transaction holds
    -- the lock, so this read cannot observe a stale/uncommitted value.
    SELECT "is_active", "allows_multiple"
    INTO v_is_active, v_allows_multiple
    FROM "public"."worker_document_types"
    WHERE "id" = p_document_type_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Worker document type % does not exist', p_document_type_id;
    END IF;

    -- 4. Verify is_active = true.
    IF NOT v_is_active THEN
        RAISE EXCEPTION 'Worker document type % is no longer active and cannot accept new documents', p_document_type_id
            USING ERRCODE = 'WDT01';
    END IF;

    -- 6. Verify the type does not allow multiple files -- replacement is a
    -- single-file-only operation; the service layer already refuses to
    -- call this RPC for an allows_multiple type, so this is defense in
    -- depth against a direct/hand-crafted call.
    IF v_allows_multiple THEN
        RAISE EXCEPTION 'Worker document type % allows multiple files and cannot be replaced via this operation', p_document_type_id;
    END IF;

    -- 5. + 7. Load, lock, and capture the existing metadata row(s) for this
    -- worker/type/semester. A FOR UPDATE loop is used, not an aggregate
    -- query, because Postgres rejects FOR UPDATE combined with aggregates.
    FOR v_old_row IN
        SELECT "id", "storage_path"
        FROM "public"."worker_documents"
        WHERE "worker_id" = p_worker_id
            AND "document_type_id" = p_document_type_id
            AND "semester_id" IS NOT DISTINCT FROM p_semester_id
        FOR UPDATE
    LOOP
        v_old_ids := array_append(v_old_ids, v_old_row."id");
        v_old_paths := array_append(v_old_paths, v_old_row."storage_path");
    END LOOP;

    -- 8. Delete the superseded metadata row(s), still inside this
    -- transaction.
    IF array_length(v_old_ids, 1) > 0 THEN
        DELETE FROM "public"."worker_documents"
        WHERE "id" = ANY(v_old_ids);
    END IF;

    -- 9. Insert the replacement metadata. Because the old row(s) were
    -- already deleted above IN THIS SAME TRANSACTION,
    -- enforce_single_worker_document_file's own "does a conflicting row
    -- already exist" check sees none -- a normal single-file replacement's
    -- insert proceeds cleanly. If this INSERT fails for ANY reason --
    -- enforce_active_worker_document_type, enforce_single_worker_document_file,
    -- enforce_worker_document_scope, a NOT NULL/CHECK constraint, or RLS's
    -- WITH CHECK -- the exception propagates out of this function
    -- uncaught, aborting the entire transaction. Postgres then
    -- automatically rolls back every effect of this function, including
    -- the DELETE above: the old row(s) are restored exactly as they were,
    -- with zero custom compensating code. The existing single-file
    -- integrity trigger is never disabled, bypassed, or session-suppressed
    -- -- it remains fully active and is what this design relies on to
    -- reject a genuine duplicate.
    INSERT INTO "public"."worker_documents" (
        "worker_id", "document_type_id", "semester_id",
        "file_name", "storage_path", "mime_type", "file_size"
    )
    VALUES (
        p_worker_id, p_document_type_id, p_semester_id,
        p_file_name, p_storage_path, p_mime_type, p_file_size
    )
    RETURNING * INTO v_new_row;

    -- 10. Return the complete new row plus the old storage paths, so the
    -- caller never needs a separate post-commit fetch to learn what it
    -- just inserted -- eliminating the ambiguous "RPC committed, but the
    -- follow-up read failed" failure mode entirely.
    RETURN QUERY SELECT
        v_new_row."id", v_new_row."worker_id", v_new_row."document_type_id",
        v_new_row."semester_id", v_new_row."file_name", v_new_row."storage_path",
        v_new_row."mime_type", v_new_row."file_size", v_new_row."uploaded_by",
        v_new_row."created_at", v_old_paths;
END;
$$;

ALTER FUNCTION "public"."replace_worker_document_metadata"(bigint, bigint, bigint, text, text, text, bigint) OWNER TO "postgres";

-- SECURITY INVOKER (the default, stated explicitly on the function above):
-- every statement in this function runs under the calling client's own
-- role, so the existing ownership-aware RLS on worker_documents (staff/
-- admin full access; worker_id = current_worker_id() for a worker) governs
-- the SELECT ... FOR UPDATE loop, the DELETE, and the INSERT exactly as it
-- already governs direct client calls today. This grant only allows an
-- authenticated session to call the function at all; it does not bypass
-- any row-level policy.
GRANT EXECUTE ON FUNCTION "public"."replace_worker_document_metadata"(bigint, bigint, bigint, text, text, text, bigint) TO "authenticated";
