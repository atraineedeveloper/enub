CREATE POLICY "Enable read access for all users" ON "public"."worker_document_categories"
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."worker_document_types"
    FOR SELECT USING (true);

CREATE POLICY "Enable read for authenticated users only" ON "public"."worker_documents"
    FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."worker_documents"
    FOR INSERT TO "authenticated" WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" ON "public"."worker_documents"
    FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users only" ON "public"."worker_documents"
    FOR DELETE TO "authenticated" USING (true);

ALTER TABLE "public"."worker_document_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."worker_document_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."worker_documents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Worker documents bucket read for authenticated users" ON "storage"."objects"
    FOR SELECT TO "authenticated"
    USING ("bucket_id" = 'worker_documents');

CREATE POLICY "Worker documents bucket insert for authenticated users" ON "storage"."objects"
    FOR INSERT TO "authenticated"
    WITH CHECK ("bucket_id" = 'worker_documents');

CREATE POLICY "Worker documents bucket update for authenticated users" ON "storage"."objects"
    FOR UPDATE TO "authenticated"
    USING ("bucket_id" = 'worker_documents')
    WITH CHECK ("bucket_id" = 'worker_documents');

CREATE POLICY "Worker documents bucket delete for authenticated users" ON "storage"."objects"
    FOR DELETE TO "authenticated"
    USING ("bucket_id" = 'worker_documents');
