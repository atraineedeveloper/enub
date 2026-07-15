-- Server-only, read-only operation-context RPC for
-- add-worker-access-email-correction (design.md §10). Distinct from the
-- browser-facing get-worker-access-email-context Edge Function -- this
-- RPC is snake_case, internal, service-role-only, and keyed by
-- operation_id, not workerId.
--
-- The Edge Function calls this immediately after a successful claim so
-- every later step in the same request works from one single,
-- authoritative view of the operation's own recorded worker/Auth
-- identity, rather than risking a second, independently-re-resolved (and
-- potentially divergent) one.
--
-- The input parameter is named p_operation_id (not operation_id) purely to
-- avoid colliding with the identically-named output column in RETURNS
-- TABLE -- Postgres rejects a function definition where a parameter and
-- an output column share one name.
CREATE OR REPLACE FUNCTION "public"."get_worker_access_email_correction_context"("p_operation_id" bigint)
RETURNS TABLE(
    "operation_id" bigint,
    "worker_id" bigint,
    "linked_auth_user_id" uuid,
    "requested_canonical_email" text,
    "raw_expected_worker_email" text,
    "state" text,
    "last_reason_code" text
)
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = ''
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "public"."worker_access_email_corrections" "c"
        WHERE "c"."id" = "get_worker_access_email_correction_context"."p_operation_id"
    ) THEN
        RAISE EXCEPTION 'No such worker access email correction operation: %', "get_worker_access_email_correction_context"."p_operation_id"
            USING ERRCODE = 'WAEC2';
    END IF;

    RETURN QUERY
    SELECT "c"."id", "c"."worker_id", "c"."linked_auth_user_id", "c"."requested_canonical_email", "c"."raw_expected_worker_email", "c"."state", "c"."last_reason_code"
    FROM "public"."worker_access_email_corrections" "c"
    WHERE "c"."id" = "get_worker_access_email_correction_context"."p_operation_id";
END;
$$;

ALTER FUNCTION "public"."get_worker_access_email_correction_context"(bigint) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_worker_access_email_correction_context"(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."get_worker_access_email_correction_context"(bigint) FROM "anon";
REVOKE ALL ON FUNCTION "public"."get_worker_access_email_correction_context"(bigint) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_worker_access_email_correction_context"(bigint) TO "service_role";
