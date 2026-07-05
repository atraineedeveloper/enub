import { useQuery } from "@tanstack/react-query";
import { getWorkerById } from "../../services/apiWorkers";
import type { Worker } from "./useWorkers";

export function useWorker(workerId: number) {
  const {
    isLoading,
    data: worker,
    error,
  } = useQuery<Worker>({
    queryKey: ["worker", workerId],
    queryFn: () => getWorkerById(workerId),
    enabled: workerId != null,
    staleTime: 5 * 60 * 1000,
  });

  return { isLoading, error, worker };
}
