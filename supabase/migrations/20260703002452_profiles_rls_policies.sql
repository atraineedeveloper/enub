ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON "public"."profiles"
    FOR SELECT TO "authenticated"
    USING ("id" = "auth"."uid"());

CREATE POLICY "Admins can read all profiles" ON "public"."profiles"
    FOR SELECT TO "authenticated"
    USING ("public"."current_app_role"() = 'admin');

-- No INSERT/UPDATE/DELETE policy is added for "authenticated". This table is
-- effectively read-only from the client's perspective (own row, or all rows
-- if admin) -- only the SECURITY DEFINER RPC functions (link_worker_account,
-- unlink_worker_account, grant_staff_role), which run as their owner
-- (postgres) and bypass RLS, write to it. See decisions.md #12.
