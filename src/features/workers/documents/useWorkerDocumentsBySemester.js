import { useQuery } from "@tanstack/react-query";
import { getWorkerDocumentsBySemester } from "../../../services/apiWorkerDocuments";
import { workerDocumentKeys } from "./workerDocumentKeys";

export function useWorkerDocumentsBySemester(workerId, semesterId) {
  const {
    isLoading,
    data: workerDocuments,
    error,
  } = useQuery({
    queryKey: workerDocumentKeys.workerSemesterDocuments(workerId, semesterId),
    queryFn: () => getWorkerDocumentsBySemester(workerId, semesterId),
    enabled: Boolean(workerId && semesterId),
  });

  return { isLoading, error, workerDocuments };
}
