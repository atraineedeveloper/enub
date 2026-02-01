import { useMutation, useQueryClient } from "@tanstack/react-query";
import { editStudyProgram } from "../../services/apiStudyPrograms";

export function useEditStudyProgram() {
  const queryClient = useQueryClient();

  const { mutate: editStudyProgramMutate, isPending: isEditing } = useMutation({
    mutationFn: ({ newProgram, id }: { newProgram: any; id: number }) =>
      editStudyProgram(newProgram, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studyPrograms"] });
    },
  });

  return { editStudyProgram: editStudyProgramMutate, isEditing };
}
