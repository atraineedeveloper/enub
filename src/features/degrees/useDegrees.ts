import { useQuery } from "@tanstack/react-query";
import { getDegrees } from "../../services/apiDegrees";

export function useDegrees() {
  const {
    isPending,
    data: degrees,
    error,
  } = useQuery({
    queryKey: ["degrees"],
    queryFn: getDegrees,
  });

  return { isLoading: isPending, error, degrees };
}
