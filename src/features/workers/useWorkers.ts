import { useQuery } from "@tanstack/react-query";
import { getWorkers, getWorkersFull } from "../../services/apiWorkers";
import type { Worker } from "../../types/entities";

export function useWorkers({ fullDetails = false }: { fullDetails?: boolean } = {}) {
  const {
    isLoading,
    data: workers,
    error,
  } = useQuery({
    queryKey: ["workers", fullDetails],
    queryFn: () => (fullDetails ? getWorkersFull() : getWorkers()),
  });

  return { isLoading, error, workers: workers as Worker[] | undefined };
}
