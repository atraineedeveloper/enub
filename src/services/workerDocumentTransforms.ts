import type { Database } from "../types/supabase";

type WorkerDocumentCategoryRow =
  Database["public"]["Tables"]["worker_document_categories"]["Row"];
type WorkerDocumentTypeRow =
  Database["public"]["Tables"]["worker_document_types"]["Row"];
type WorkerDocumentRow = Database["public"]["Tables"]["worker_documents"]["Row"];

export function groupDocumentTypesByCategory(
  categories: WorkerDocumentCategoryRow[] = [],
  documentTypes: WorkerDocumentTypeRow[] = []
) {
  return categories.map((category) => ({
    ...category,
    document_types: documentTypes.filter(
      (documentType) => documentType.category_id === category.id
    ),
  }));
}

// Builds the client-facing replaced-document object directly from
// replace_worker_document_metadata's own RETURNING row, plus the document
// type already fetched earlier in the same call -- this is the entire
// "success result" the RPC's design (finding #4) exists to make possible:
// no separate post-commit fetch is ever needed to learn what was just
// inserted, since the RPC's own transaction already returned it.
export function buildReplacedWorkerDocument(
  result: {
    new_id: number;
    new_worker_id: number;
    new_document_type_id: number;
    new_semester_id: number | null;
    new_file_name: string;
    new_storage_path: string;
    new_mime_type: string;
    new_file_size: number;
    new_uploaded_by: string | null;
    new_created_at: string;
  },
  documentType: unknown
) {
  return {
    id: result.new_id,
    worker_id: result.new_worker_id,
    document_type_id: result.new_document_type_id,
    semester_id: result.new_semester_id,
    file_name: result.new_file_name,
    storage_path: result.new_storage_path,
    mime_type: result.new_mime_type,
    file_size: result.new_file_size,
    uploaded_by: result.new_uploaded_by,
    created_at: result.new_created_at,
    worker_document_types: documentType,
  };
}

export function addReportStatusToCategories(
  categories: (WorkerDocumentCategoryRow & {
    document_types: WorkerDocumentTypeRow[];
  })[] = [],
  documents: WorkerDocumentRow[] = []
) {
  return categories.map((category) => ({
    ...category,
    // Union rule (matching WorkerDocumentsView.tsx): a type appears in this
    // worker's own report only when it is active, or this same worker has
    // at least one document under it -- an inactive type with none for
    // this worker is omitted entirely, never rendered as "Pendiente".
    document_types: category.document_types
      .filter((documentType) => {
        const hasDocumentsForThisWorker = documents.some(
          (document) => document.document_type_id === documentType.id
        );
        return documentType.is_active || hasDocumentsForThisWorker;
      })
      .map((documentType) => {
        const uploadedDocuments = documents.filter(
          (document) => document.document_type_id === documentType.id
        );

        return {
          ...documentType,
          documents: uploadedDocuments,
          status: uploadedDocuments.length ? "Cargado" : "Pendiente",
          uploaded_at: uploadedDocuments[0]?.created_at ?? null,
          file_name: uploadedDocuments[0]?.file_name ?? null,
        };
      }),
  }));
}

