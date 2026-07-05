import { useQuery } from "@tanstack/react-query";
import { getWorkers, getWorkersFull } from "../../services/apiWorkers";
import type { Database } from "../../types/supabase";

export type Worker = Database["public"]["Tables"]["workers"]["Row"];

interface UseWorkersOptions {
  fullDetails?: boolean;
}

export function useWorkers({ fullDetails = false }: UseWorkersOptions = {}) {
  const {
    isLoading,
    data: workers,
    error,
  } = useQuery<Worker[]>({
    queryKey: ["workers", fullDetails],
    queryFn: () => (fullDetails ? getWorkersFull() : getWorkers()),
    staleTime: 5 * 60 * 1000,
  });

  return { isLoading, error, workers };
}
