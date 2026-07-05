import { useQuery } from "@tanstack/react-query";
import { getWorkerDocumentCategoriesAndTypes } from "../../../services/apiWorkerDocuments";
import { workerDocumentKeys } from "./workerDocumentKeys";

// worker_document_categories/worker_document_types exist in the DB (see
// supabase/migrations/20260702145810_worker_document_categories.sql and
// 20260702145829_worker_document_types.sql) but are absent from the generated
// src/types/supabase.ts -- that file predates these tables and hasn't been
// regenerated. Hand-rolled here to match the migrations' columns exactly,
// rather than editing the generated file or running codegen (out of scope).
export interface WorkerDocumentType {
  id: number;
  category_id: number;
  name: string;
  allows_multiple: boolean;
  sort_order: number;
  created_at: string;
}

export interface WorkerDocumentCategory {
  id: number;
  name: string;
  scope: "permanent" | "semester";
  sort_order: number;
  created_at: string;
  document_types: WorkerDocumentType[];
}

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
