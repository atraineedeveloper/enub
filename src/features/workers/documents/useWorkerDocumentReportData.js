import { useQuery } from "@tanstack/react-query";
import { getWorkerDocumentReportData } from "../../../services/apiWorkerDocuments";
import { workerDocumentKeys } from "./workerDocumentKeys";

export function useWorkerDocumentReportData(workerId, semesterId = null) {
  const {
    isLoading,
    data: reportData,
    error,
  } = useQuery({
    queryKey: workerDocumentKeys.report(workerId, semesterId),
    queryFn: () => getWorkerDocumentReportData(workerId, semesterId),
    enabled: Boolean(workerId),
  });

  return { isLoading, error, reportData };
}
