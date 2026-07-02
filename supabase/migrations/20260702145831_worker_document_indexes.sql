CREATE INDEX "worker_document_types_category_id_idx"
    ON "public"."worker_document_types" USING "btree" ("category_id");

CREATE INDEX "worker_documents_worker_id_idx"
    ON "public"."worker_documents" USING "btree" ("worker_id");

CREATE INDEX "worker_documents_worker_id_semester_id_idx"
    ON "public"."worker_documents" USING "btree" ("worker_id", "semester_id");

CREATE INDEX "worker_documents_document_type_id_idx"
    ON "public"."worker_documents" USING "btree" ("document_type_id");
