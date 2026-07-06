import { useQuery } from "@tanstack/react-query";
import { getStateRoles } from "../../services/apiStateRoles";
import type { Database } from "../../types/supabase";

export type StateRole = Database["public"]["Tables"]["state_roles"]["Row"];

export function useStateRoles() {
  const {
    isLoading,
    data: stateRoles,
    error,
  } = useQuery<StateRole[]>({
    queryKey: ["stateRoles"],
    queryFn: getStateRoles,
    staleTime: 5 * 60 * 1000,
  });

  return { isLoading, error, stateRoles };
}
