import { useQuery } from "@tanstack/react-query";
import { getWorkerDocuments } from "../../../services/apiWorkerDocuments";
import { workerDocumentKeys } from "./workerDocumentKeys";

export function useWorkerDocuments(workerId) {
  const {
    isLoading,
    data: workerDocuments,
    error,
  } = useQuery({
    queryKey: workerDocumentKeys.workerDocuments(workerId),
    queryFn: () => getWorkerDocuments(workerId),
    enabled: Boolean(workerId),
  });

  return { isLoading, error, workerDocuments };
}
