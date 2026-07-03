-- Storage path ownership already encodes the owning worker as the first
-- path segment (createWorkerDocumentStoragePath in apiWorkerDocuments.js:
-- `${workerId}/${documentTypeId}/${scopeFolder}/...`). See decisions.md #14.

DROP POLICY IF EXISTS "Worker documents bucket read for authenticated users" ON "storage"."objects";
DROP POLICY IF EXISTS "Worker documents bucket insert for authenticated users" ON "storage"."objects";
DROP POLICY IF EXISTS "Worker documents bucket update for authenticated users" ON "storage"."objects";
DROP POLICY IF EXISTS "Worker documents bucket delete for authenticated users" ON "storage"."objects";

CREATE POLICY "Staff and admin access worker documents bucket" ON "storage"."objects"
    FOR ALL TO "authenticated"
    USING (
        "bucket_id" = 'worker_documents'
        AND "public"."current_app_role"() IN ('staff', 'admin')
    )
    WITH CHECK (
        "bucket_id" = 'worker_documents'
        AND "public"."current_app_role"() IN ('staff', 'admin')
    );

CREATE POLICY "Workers access own worker documents bucket path" ON "storage"."objects"
    FOR ALL TO "authenticated"
    USING (
        "bucket_id" = 'worker_documents'
        AND ("storage"."foldername"("name"))[1] = ("public"."current_worker_id"())::text
    )
    WITH CHECK (
        "bucket_id" = 'worker_documents'
        AND ("storage"."foldername"("name"))[1] = ("public"."current_worker_id"())::text
    );

-- If current_worker_id() is NULL (no role, or role isn't 'worker'),
-- (storage.foldername(name))[1] = NULL::text is never true -- correctly denies.
