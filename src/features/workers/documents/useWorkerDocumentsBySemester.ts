import { useQuery } from "@tanstack/react-query";
import { getWorkerDocumentsBySemester } from "../../../services/apiWorkerDocuments";
import { workerDocumentKeys } from "./workerDocumentKeys";
import type { WorkerDocument } from "./useWorkerDocuments";

export function useWorkerDocumentsBySemester(
  workerId: number,
  semesterId: number | string
) {
  const {
    isLoading,
    data: workerDocuments,
    error,
  } = useQuery<WorkerDocument[]>({
    queryKey: workerDocumentKeys.workerSemesterDocuments(workerId, semesterId),
    queryFn: () => getWorkerDocumentsBySemester(workerId, semesterId),
    enabled: Boolean(workerId && semesterId),
  });

  return { isLoading, error, workerDocuments };
}
