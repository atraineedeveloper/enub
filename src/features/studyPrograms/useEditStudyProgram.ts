import { useMutation, useQueryClient } from "@tanstack/react-query";
import { editStudyProgram } from "../../services/apiStudyPrograms";
import type { StudyProgram } from "./useStudyPrograms";

interface EditStudyProgramVariables {
  newProgram: Partial<StudyProgram>;
  id: number;
}

export function useEditStudyProgram() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ newProgram, id }: EditStudyProgramVariables) =>
      editStudyProgram(newProgram, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studyPrograms"] });
    },
  });
  const { mutate: editStudyProgramMutate } = mutation;
  // TanStack Query v5's useMutation has no `isLoading` (only `isPending`) —
  // this was already always `undefined` at runtime before this file had any
  // type checking at all. Preserved exactly, not fixed — see design.md.
  const isEditing = (mutation as unknown as { isLoading?: boolean }).isLoading;

  return { editStudyProgram: editStudyProgramMutate, isEditing };
}
