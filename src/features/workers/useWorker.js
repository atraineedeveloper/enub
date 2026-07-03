import { useQuery } from "@tanstack/react-query";
import { getWorkerById } from "../../services/apiWorkers";

export function useWorker(workerId) {
  const {
    isLoading,
    data: worker,
    error,
  } = useQuery({
    queryKey: ["worker", workerId],
    queryFn: () => getWorkerById(workerId),
    enabled: workerId != null,
    staleTime: 5 * 60 * 1000,
  });

  return { isLoading, error, worker };
}
