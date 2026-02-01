import { useQuery } from "@tanstack/react-query";
import { getStudyPrograms } from "../../services/apiStudyPrograms";

export function useStudyPrograms() {
  const {
    isPending,
    data: studyPrograms,
    error,
  } = useQuery({
    queryKey: ["studyPrograms"],
    queryFn: getStudyPrograms,
  });

  return { isLoading: isPending, error, studyPrograms };
}
