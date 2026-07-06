import { useQuery } from "@tanstack/react-query";
import { getUtilies } from "../../services/apiUtilities";
import type { Database } from "../../types/supabase";

export type Utility = Database["public"]["Tables"]["utilities"]["Row"];

export function useUtilities() {
  const {
    isLoading,
    data: utilities,
    error,
  } = useQuery<Utility[]>({
    queryKey: ["utilities"],
    queryFn: getUtilies,
    staleTime: 5 * 60 * 1000,
  });

  return { isLoading, error, utilities };
}
