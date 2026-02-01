import { useQuery } from "@tanstack/react-query";
import { getSubjects } from "../../services/apiSubjects";
import type { Subject } from "../../types/entities";

export function useSubjects() {
  const {
    isLoading,
    data: subjects,
    error,
  } = useQuery({
    queryKey: ["subjects"],
    queryFn: getSubjects,
  });

  return { isLoading, error, subjects: subjects as Subject[] | undefined };
}
