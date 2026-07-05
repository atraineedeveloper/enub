import { useQuery } from "@tanstack/react-query";
import { getWorkerDocuments } from "../../../services/apiWorkerDocuments";
import { workerDocumentKeys } from "./workerDocumentKeys";

// worker_documents exists in the DB (supabase/migrations/20260702145830_worker_documents.sql)
// but is absent from the generated src/types/supabase.ts (same gap as
// useWorkerDocumentCatalog.ts's WorkerDocumentType/WorkerDocumentCategory).
// Hand-rolled to match the migration's columns; the base row only -- the
// `worker_document_types(*, worker_document_categories(*))`/`semesters(*)`
// embeds this select also returns are never read by any current consumer
// (WorkerDocumentsView only reads base columns), so they're deferred here,
// same as Worker/date_of_admissions in Phase 1/2.
export interface WorkerDocument {
  id: number;
  worker_id: number;
  document_type_id: number;
  semester_id: number | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export function useWorkerDocuments(workerId: number) {
  const {
    isLoading,
    data: workerDocuments,
    error,
  } = useQuery<WorkerDocument[]>({
    queryKey: workerDocumentKeys.workerDocuments(workerId),
    queryFn: () => getWorkerDocuments(workerId),
    enabled: Boolean(workerId),
  });

  return { isLoading, error, workerDocuments };
}
