import { useQuery } from "@tanstack/react-query";
import { getWorkerDocuments } from "../../../services/apiWorkerDocuments";
import { workerDocumentKeys } from "./workerDocumentKeys";
import type { Database } from "../../../types/supabase";

// Base row only -- the `worker_document_types(*, worker_document_categories(*))`/
// `semesters(*)` embeds this select also returns are never read by any current
// consumer (WorkerDocumentsView only reads base columns), so they're deferred
// here, same as Worker/date_of_admissions in Phase 1/2.
export type WorkerDocument =
  Database["public"]["Tables"]["worker_documents"]["Row"];

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
