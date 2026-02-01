import { useQuery } from "@tanstack/react-query";
import { getStateRoles } from "../../services/apiStateRoles";

export function useStateRoles() {
  const {
    isPending,
    data: stateRoles,
    error,
  } = useQuery({
    queryKey: ["stateRoles"],
    queryFn: getStateRoles,
  });

  return { isLoading: isPending, error, stateRoles };
}
