import { useQuery } from "@tanstack/react-query";
import { getStateRoles } from "../../services/apiStateRoles";

export function useStateRoles() {
  const {
    isLoading,
    data: stateRoles,
    error,
  } = useQuery({
    queryKey: ["stateRoles"],
    queryFn: getStateRoles,
    staleTime: 5 * 60 * 1000,
  });

  return { isLoading, error, stateRoles };
}
