import { useQuery } from "@tanstack/react-query";
import { getDegrees } from "../../services/apiDegrees";
import type { Database } from "../../types/supabase";

export type Degree = Database["public"]["Tables"]["degrees"]["Row"];

export function useDegrees() {
  const {
    isLoading,
    data: degrees,
    error,
  } = useQuery<Degree[]>({
    queryKey: ["degrees"],
    queryFn: getDegrees,
    staleTime: 60 * 60 * 1000,
  });

  return { isLoading, error, degrees };
}
