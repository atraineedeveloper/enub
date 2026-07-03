-- Today public.workers has "FOR SELECT USING (true)" and
-- "FOR UPDATE USING (true) WITH CHECK (true)" with no TO clause -- meaning
-- even anon can read and update every worker row. This tightens both to
-- TO authenticated plus an explicit role IN ('staff', 'admin') check
-- (worker: own row only, read-only). See decisions.md #12.

DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."workers";
DROP POLICY IF EXISTS "Enable update access for all users" ON "public"."workers";

CREATE POLICY "Staff and admin can read all workers" ON "public"."workers"
    FOR SELECT TO "authenticated"
    USING ("public"."current_app_role"() IN ('staff', 'admin'));

CREATE POLICY "Workers can read own worker row" ON "public"."workers"
    FOR SELECT TO "authenticated"
    USING ("id" = "public"."current_worker_id"());

CREATE POLICY "Staff and admin can update workers" ON "public"."workers"
    FOR UPDATE TO "authenticated"
    USING ("public"."current_app_role"() IN ('staff', 'admin'))
    WITH CHECK ("public"."current_app_role"() IN ('staff', 'admin'));

-- No INSERT/DELETE policy is added or touched here -- there was none before
-- this feature either (pre-existing gap, out of scope). See decisions.md #12.
