import { useQuery } from "@tanstack/react-query";
import { getStudyPrograms } from "../../services/apiStudyPrograms";
import type { Database } from "../../types/supabase";

export type StudyProgram = Database["public"]["Tables"]["study_programs"]["Row"];

export function useStudyPrograms() {
  const {
    isLoading,
    data: studyPrograms,
    error,
  } = useQuery<StudyProgram[]>({
    queryKey: ["studyPrograms"],
    queryFn: getStudyPrograms,
    staleTime: 60 * 60 * 1000,
  });

  return { isLoading, error, studyPrograms };
}
