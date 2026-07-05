import { useQuery } from "@tanstack/react-query";
import { getRoles } from "../../services/apiRoles";
import type { Database } from "../../types/supabase";

export type Role = Database["public"]["Tables"]["roles"]["Row"] & {
  workers: Database["public"]["Tables"]["workers"]["Row"] | null;
};

export function useRoles() {
  const {
    isLoading,
    data: roles,
    error,
  } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: getRoles,
    staleTime: 5 * 60 * 1000,
  });

  return { isLoading, error, roles };
}
