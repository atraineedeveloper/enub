CREATE OR REPLACE FUNCTION "public"."enforce_worker_document_scope"()
RETURNS trigger
LANGUAGE "plpgsql"
SET "search_path" = ''
AS $$
DECLARE
    category_scope text;
BEGIN
    SELECT "worker_document_categories"."scope"
    INTO category_scope
    FROM "public"."worker_document_types"
    JOIN "public"."worker_document_categories"
        ON "worker_document_categories"."id" = "worker_document_types"."category_id"
    WHERE "worker_document_types"."id" = NEW."document_type_id";

    IF category_scope IS NULL THEN
        RAISE EXCEPTION 'Worker document type % does not exist', NEW."document_type_id";
    END IF;

    IF category_scope = 'permanent' AND NEW."semester_id" IS NOT NULL THEN
        RAISE EXCEPTION 'Permanent worker documents cannot be tied to a semester';
    END IF;

    IF category_scope = 'semester' AND NEW."semester_id" IS NULL THEN
        RAISE EXCEPTION 'Semester worker documents require semester_id';
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."enforce_worker_document_scope"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."enforce_single_worker_document_file"()
RETURNS trigger
LANGUAGE "plpgsql"
SET "search_path" = ''
AS $$
DECLARE
    document_allows_multiple boolean;
BEGIN
    SELECT "worker_document_types"."allows_multiple"
    INTO document_allows_multiple
    FROM "public"."worker_document_types"
    WHERE "worker_document_types"."id" = NEW."document_type_id";

    IF document_allows_multiple IS NULL THEN
        RAISE EXCEPTION 'Worker document type % does not exist', NEW."document_type_id";
    END IF;

    IF document_allows_multiple = false AND EXISTS (
        SELECT 1
        FROM "public"."worker_documents"
        WHERE "worker_documents"."worker_id" = NEW."worker_id"
            AND "worker_documents"."document_type_id" = NEW."document_type_id"
            AND "worker_documents"."semester_id" IS NOT DISTINCT FROM NEW."semester_id"
            AND "worker_documents"."id" <> COALESCE(NEW."id", 0)
    ) THEN
        RAISE EXCEPTION 'This worker document type allows only one active file for the selected scope';
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."enforce_single_worker_document_file"() OWNER TO "postgres";

CREATE TRIGGER "enforce_worker_document_scope_trigger"
    BEFORE INSERT OR UPDATE ON "public"."worker_documents"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."enforce_worker_document_scope"();

CREATE TRIGGER "enforce_single_worker_document_file_trigger"
    BEFORE INSERT OR UPDATE ON "public"."worker_documents"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."enforce_single_worker_document_file"();
