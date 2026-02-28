import { useQuery } from "@tanstack/react-query";
import { getRoles } from "../../services/apiRoles";

export function useRoles() {
  const {
    isLoading,
    data: roles,
    error,
  } = useQuery({
    queryKey: ["roles"],
    queryFn: getRoles,
    staleTime: 5 * 60 * 1000,
  });

  return { isLoading, error, roles };
}
