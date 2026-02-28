import { useQuery } from "@tanstack/react-query";
import { getWorkers, getWorkersFull } from "../../services/apiWorkers";

export function useWorkers({ fullDetails = false } = {}) {
  const {
    isLoading,
    data: workers,
    error,
  } = useQuery({
    queryKey: ["workers", fullDetails],
    queryFn: () => (fullDetails ? getWorkersFull() : getWorkers()),
    staleTime: 5 * 60 * 1000,
  });

  return { isLoading, error, workers };
}
