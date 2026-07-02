import { useQuery } from "@tanstack/react-query";
import { getWorkerDocumentSignedUrl } from "../../../services/apiWorkerDocuments";
import { workerDocumentKeys } from "./workerDocumentKeys";

export function useWorkerDocumentSignedUrl(storagePath) {
  const {
    isLoading,
    data: signedUrl,
    error,
  } = useQuery({
    queryKey: workerDocumentKeys.signedUrl(storagePath),
    queryFn: () => getWorkerDocumentSignedUrl(storagePath),
    enabled: Boolean(storagePath),
    staleTime: 50 * 60 * 1000,
  });

  return { isLoading, error, signedUrl };
}
