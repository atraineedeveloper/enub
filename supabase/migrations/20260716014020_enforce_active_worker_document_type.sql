CREATE OR REPLACE FUNCTION "public"."enforce_active_worker_document_type"()
RETURNS trigger
LANGUAGE "plpgsql"
SET "search_path" = ''
AS $$
DECLARE
    type_is_active boolean;
BEGIN
    -- An UPDATE that does not change document_type_id is an edit to an
    -- existing, already-accepted historical row -- never blocked here, even
    -- when that row's type is inactive. OLD is only referenced inside this
    -- TG_OP = 'UPDATE' branch, so it is never evaluated during INSERT
    -- (where OLD does not exist).
    IF TG_OP = 'UPDATE' THEN
        IF NEW."document_type_id" IS NOT DISTINCT FROM OLD."document_type_id" THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Reached for every INSERT, and for an UPDATE that changes
    -- document_type_id. Acquire the shared lifecycle advisory lock for this
    -- document type BEFORE reading is_active: this serializes against a
    -- concurrent retirement (the retirement migration and
    -- replace_worker_document_metadata both acquire the identical lock,
    -- same namespace, before their own is_active read/write), so this read
    -- can never observe a stale value from a retirement that is
    -- mid-transaction. This is a transaction-level (xact) advisory lock,
    -- automatically released at COMMIT/ROLLBACK -- an operation-
    -- serialization mechanism, not an authorization boundary; no row lock
    -- is taken or implied here.
    PERFORM "pg_advisory_xact_lock"(
        "hashtextextended"(
            'worker_document_type:lifecycle:' || NEW."document_type_id"::text,
            0
        )
    );

    SELECT "worker_document_types"."is_active"
    INTO type_is_active
    FROM "public"."worker_document_types"
    WHERE "worker_document_types"."id" = NEW."document_type_id";

    IF type_is_active IS NULL THEN
        RAISE EXCEPTION 'Worker document type % does not exist', NEW."document_type_id";
    END IF;

    IF type_is_active = false THEN
        RAISE EXCEPTION 'Worker document type % is no longer active and cannot accept new documents', NEW."document_type_id"
            USING ERRCODE = 'WDT01';
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."enforce_active_worker_document_type"() OWNER TO "postgres";

CREATE TRIGGER "enforce_active_worker_document_type_trigger"
    BEFORE INSERT OR UPDATE ON "public"."worker_documents"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."enforce_active_worker_document_type"();
