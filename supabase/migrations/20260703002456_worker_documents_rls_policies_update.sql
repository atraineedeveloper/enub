-- Replaces the fully-open "any authenticated user" policies from
-- worker-document-uploads with an ownership-aware model: staff/admin keep
-- unrestricted access (unchanged behavior for them); workers are scoped to
-- their own worker_id via current_worker_id(). See decisions.md #13.

DROP POLICY IF EXISTS "Enable read for authenticated users only" ON "public"."worker_documents";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."worker_documents";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."worker_documents";
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON "public"."worker_documents";

CREATE POLICY "Staff and admin manage all worker documents" ON "public"."worker_documents"
    FOR ALL TO "authenticated"
    USING ("public"."current_app_role"() IN ('staff', 'admin'))
    WITH CHECK ("public"."current_app_role"() IN ('staff', 'admin'));

CREATE POLICY "Workers manage own worker documents" ON "public"."worker_documents"
    FOR ALL TO "authenticated"
    USING ("worker_id" = "public"."current_worker_id"())
    WITH CHECK ("worker_id" = "public"."current_worker_id"());

-- A session with no profiles row: current_app_role() is NULL (NULL IN (...)
-- is not true) and current_worker_id() is NULL (worker_id = NULL is never
-- true) -- denied by both policies, no special case needed.
