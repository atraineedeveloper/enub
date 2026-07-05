import { useMutation, useQueryClient } from "@tanstack/react-query";
import { editStudyProgram } from "../../services/apiStudyPrograms";
import type { StudyProgram } from "./useStudyPrograms";

interface EditStudyProgramVariables {
  newProgram: Partial<StudyProgram>;
  id: number;
}

export function useEditStudyProgram() {
  const queryClient = useQueryClient();

  const { mutate: editStudyProgramMutate, isPending: isEditing } = useMutation({
    mutationFn: ({ newProgram, id }: EditStudyProgramVariables) =>
      editStudyProgram(newProgram, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studyPrograms"] });
    },
  });

  return { editStudyProgram: editStudyProgramMutate, isEditing };
}
