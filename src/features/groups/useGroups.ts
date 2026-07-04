import { useQuery } from "@tanstack/react-query";
import { getGroups } from "../../services/apiGroups";
import type { Database } from "../../types/supabase";

export type Group = Database["public"]["Tables"]["groups"]["Row"] & {
  degrees: Database["public"]["Tables"]["degrees"]["Row"] | null;
};

export function useGroups() {
  const {
    isLoading,
    data: groups,
    error,
  } = useQuery<Group[]>({
    queryKey: ["groups"],
    queryFn: getGroups,
    staleTime: 30 * 60 * 1000,
  });

  return { isLoading, error, groups };
}
