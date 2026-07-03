CREATE OR REPLACE FUNCTION "public"."grant_staff_role"("staff_email" text)
RETURNS void
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
DECLARE
    target_auth_id uuid;
    existing_role text;
BEGIN
    -- IS DISTINCT FROM (not <>): NULL-safe, so a caller with no profiles
    -- row (current_app_role() = NULL) is correctly rejected instead of
    -- silently passing this guard. See link_worker_account for the same fix.
    IF "public"."current_app_role"() IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Only admins can grant staff role';
    END IF;

    SELECT "id" INTO target_auth_id
    FROM "auth"."users"
    WHERE "email" = "staff_email";

    IF target_auth_id IS NULL THEN
        RAISE EXCEPTION 'No auth account found for %', "staff_email";
    END IF;

    SELECT "role" INTO existing_role
    FROM "public"."profiles"
    WHERE "id" = target_auth_id;

    IF existing_role = 'worker' THEN
        RAISE EXCEPTION 'This account is linked to a worker; call unlink_worker_account first if converting it to staff is intentional';
    END IF;

    INSERT INTO "public"."profiles" ("id", "role", "worker_id")
    VALUES (target_auth_id, 'staff', NULL)
    ON CONFLICT ("id") DO UPDATE SET "role" = 'staff', "worker_id" = NULL;
END;
$$;

ALTER FUNCTION "public"."grant_staff_role"(text) OWNER TO "postgres";

-- Closes the operational gap created by decisions.md #7 (no more implicit
-- staff default): this is how a new staff member gets access after launch,
-- without needing Studio SQL access. Never grants 'admin' -- promoting to
-- admin stays a manual step (decisions.md #5).
GRANT EXECUTE ON FUNCTION "public"."grant_staff_role"(text) TO "authenticated";
