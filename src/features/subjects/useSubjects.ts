import { useQuery } from "@tanstack/react-query";
import { getSubjects } from "../../services/apiSubjects";
import type { Database } from "../../types/supabase";

export type Subject = Database["public"]["Tables"]["subjects"]["Row"] & {
  study_programs: Database["public"]["Tables"]["study_programs"]["Row"] | null;
  degrees: Database["public"]["Tables"]["degrees"]["Row"] | null;
};

export function useSubjects() {
  const {
    isLoading,
    data: subjects,
    error,
  } = useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: getSubjects,
    staleTime: 30 * 60 * 1000,
  });

  return { isLoading, error, subjects };
}
