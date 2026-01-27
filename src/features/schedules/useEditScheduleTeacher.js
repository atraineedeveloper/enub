import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditScheduleTeachers } from "../../services/apiScheduleTeachers";
import toast from "react-hot-toast";

export function useEditScheduleTeacher() {
  const queryClient = useQueryClient();

  const { mutate: editScheduleTeacher, isLoading: isEditing } = useMutation({
    mutationFn: ({ newScheduleData, id }) =>
      createEditScheduleTeachers(newScheduleData, id),
    onSuccess: () => {
      toast.success("Horario de actividad actualizado correctamente");
      queryClient.invalidateQueries({ queryKey: ["scheduleTeachers"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return { isEditing, editScheduleTeacher };
}
