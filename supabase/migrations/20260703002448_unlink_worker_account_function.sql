CREATE OR REPLACE FUNCTION "public"."unlink_worker_account"("worker_id" bigint)
RETURNS void
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
BEGIN
    -- IS DISTINCT FROM (not <>): NULL-safe, so a caller with no profiles
    -- row (current_app_role() = NULL) is correctly rejected instead of
    -- silently passing this guard. See link_worker_account for the same fix.
    IF "public"."current_app_role"() IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Only admins can unlink worker accounts';
    END IF;

    DELETE FROM "public"."profiles"
    WHERE "profiles"."worker_id" = "unlink_worker_account"."worker_id" AND "profiles"."role" = 'worker';
END;
$$;

ALTER FUNCTION "public"."unlink_worker_account"(bigint) OWNER TO "postgres";

-- After this runs, the account reverts to no profiles row, i.e. no access
-- (decisions.md #7) -- never a fallback to staff. This is also the sanctioned
-- way to free up a workers row for deletion, since profiles.worker_id is
-- ON DELETE RESTRICT (decisions.md #19).
GRANT EXECUTE ON FUNCTION "public"."unlink_worker_account"(bigint) TO "authenticated";
