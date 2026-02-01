import { useQuery } from "@tanstack/react-query";
import { getUtilies } from "../../services/apiUtilities";

export function useUtilities() {
  const {
    isPending,
    data: utilities,
    error,
  } = useQuery({
    queryKey: ["utilities"],
    queryFn: getUtilies,
  });

  return { isLoading: isPending, error, utilities };
}
