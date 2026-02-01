import { useQuery } from "@tanstack/react-query";
import { getGroups } from "../../services/apiGroups";
import type { Group } from "../../types/entities";

export function useGroups() {
  const {
    isLoading,
    data: groups,
    error,
  } = useQuery({
    queryKey: ["groups"],
    queryFn: getGroups,
  });

  return { isLoading, error, groups: groups as Group[] | undefined };
}
