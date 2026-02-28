import { useQuery } from "@tanstack/react-query";
import { getSubjects } from "../../services/apiSubjects";

export function useSubjects() {
  const {
    isLoading,
    data: subjects,
    error,
  } = useQuery({
    queryKey: ["subjects"],
    queryFn: getSubjects,
    staleTime: 30 * 60 * 1000,
  });

  return { isLoading, error, subjects };
}
