import { useQuery } from "@tanstack/react-query";
import { getWorkerDocumentCategoriesAndTypes } from "../../../services/apiWorkerDocuments";
import { workerDocumentKeys } from "./workerDocumentKeys";

export function useWorkerDocumentCatalog() {
  const {
    isLoading,
    data: documentCatalog,
    error,
  } = useQuery({
    queryKey: workerDocumentKeys.catalog(),
    queryFn: getWorkerDocumentCategoriesAndTypes,
    staleTime: 5 * 60 * 1000,
  });

  return { isLoading, error, documentCatalog };
}
