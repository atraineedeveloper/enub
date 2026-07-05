import { useQuery } from "@tanstack/react-query";
import { getWorkerDocumentCategoriesAndTypes } from "../../../services/apiWorkerDocuments";
import { workerDocumentKeys } from "./workerDocumentKeys";
import type { Database } from "../../../types/supabase";

export type WorkerDocumentType =
  Database["public"]["Tables"]["worker_document_types"]["Row"];

// `document_types` is an application-computed grouping
// (`groupDocumentTypesByCategory` in apiWorkerDocuments.js), not a DB column or
// Supabase embed -- composed onto the generated `worker_document_categories`
// row rather than part of it. An indexed-access type (`Database["public"][...]`)
// can't appear in an `interface extends` clause, so this is a type alias
// intersection instead of an `interface`.
export type WorkerDocumentCategory =
  Database["public"]["Tables"]["worker_document_categories"]["Row"] & {
    document_types: WorkerDocumentType[];
  };

export function useWorkerDocumentCatalog() {
  const {
    isLoading,
    data: documentCatalog,
    error,
  } = useQuery<WorkerDocumentCategory[]>({
    queryKey: workerDocumentKeys.catalog(),
    queryFn: getWorkerDocumentCategoriesAndTypes,
    staleTime: 5 * 60 * 1000,
  });

  return { isLoading, error, documentCatalog };
}
