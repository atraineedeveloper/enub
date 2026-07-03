CREATE OR REPLACE FUNCTION "public"."link_worker_account"(
    "worker_id" bigint,
    "worker_email" text
)
RETURNS void
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
DECLARE
    target_auth_id uuid;
    existing_role text;
BEGIN
    -- IS DISTINCT FROM (not <>): current_app_role() returns NULL for a
    -- caller with no profiles row, and plain `<>` with NULL evaluates to
    -- NULL, which "IF ... THEN" treats as false -- silently skipping this
    -- guard instead of raising. IS DISTINCT FROM is NULL-safe and correctly
    -- treats "no role" as "not admin".
    IF "public"."current_app_role"() IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Only admins can link worker accounts';
    END IF;

    SELECT "id" INTO target_auth_id
    FROM "auth"."users"
    WHERE "email" = "worker_email";

    IF target_auth_id IS NULL THEN
        RAISE EXCEPTION 'No auth account found for %', "worker_email";
    END IF;

    SELECT "role" INTO existing_role
    FROM "public"."profiles"
    WHERE "id" = target_auth_id;

    IF existing_role IN ('admin', 'staff') THEN
        RAISE EXCEPTION 'This account already has role % and cannot be linked as a worker; revoke that role first if this is intentional', existing_role;
    END IF;

    IF existing_role = 'worker' THEN
        RAISE EXCEPTION 'This account is already linked to a different worker; call unlink_worker_account first';
    END IF;

    IF EXISTS (
        SELECT 1 FROM "public"."profiles"
        WHERE "profiles"."worker_id" = "link_worker_account"."worker_id"
    ) THEN
        RAISE EXCEPTION 'Worker % already has a linked account; unlink it first', "link_worker_account"."worker_id";
    END IF;

    INSERT INTO "public"."profiles" ("id", "role", "worker_id")
    VALUES (target_auth_id, 'worker', "link_worker_account"."worker_id");
END;
$$;

ALTER FUNCTION "public"."link_worker_account"(bigint, text) OWNER TO "postgres";

-- Safe to grant broadly: the function itself enforces the admin-only check
-- (and the role-collision checks above) before writing anything. See
-- decisions.md #4 and #16.
GRANT EXECUTE ON FUNCTION "public"."link_worker_account"(bigint, text) TO "authenticated";
