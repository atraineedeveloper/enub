import { useQuery } from "@tanstack/react-query";
import { getWorkers, getWorkersFull } from "../../services/apiWorkers";
import type { Database } from "../../types/supabase";

export type Worker = Database["public"]["Tables"]["workers"]["Row"];

export type DateOfAdmission =
  Database["public"]["Tables"]["date_of_admissions"]["Row"];
export type SustenancePlaza =
  Database["public"]["Tables"]["sustenance_plazas"]["Row"];

// getWorkersFull() (used whenever fullDetails: true) embeds these two
// to-many child relations (their FK points at workers, so Supabase returns
// arrays, never null) — modeled separately from the base `Worker` type since
// getWorkers() (fullDetails: false) has neither field populated.
export type WorkerWithDetails = Worker & {
  date_of_admissions: DateOfAdmission[];
  sustenance_plazas: SustenancePlaza[];
};

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
