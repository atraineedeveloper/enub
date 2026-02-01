import { useQuery } from "@tanstack/react-query";
import { getRoles } from "../../services/apiRoles";

export function useRoles() {
  const {
    isPending,
    data: roles,
    error,
  } = useQuery({
    queryKey: ["roles"],
    queryFn: getRoles,
  });

  return { isLoading: isPending, error, roles };
}
