import { useQuery } from "@tanstack/react-query";
import { getUtilies } from "../../services/apiUtilities";

export function useUtilities() {
  const {
    isLoading,
    data: utilities,
    error,
  } = useQuery({
    queryKey: ["utilities"],
    queryFn: getUtilies,
    staleTime: 5 * 60 * 1000,
  });

  return { isLoading, error, utilities };
}
