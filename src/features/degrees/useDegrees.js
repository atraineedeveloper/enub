import { useQuery } from "@tanstack/react-query";
import { getDegrees } from "../../services/apiDegrees";

export function useDegrees() {
  const {
    isLoading,
    data: degrees,
    error,
  } = useQuery({
    queryKey: ["degrees"],
    queryFn: getDegrees,
    staleTime: 60 * 60 * 1000,
  });

  return { isLoading, error, degrees };
}
