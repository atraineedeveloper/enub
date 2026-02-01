import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditScheduleTeachers } from "../../services/apiScheduleTeachers";
import toast from "react-hot-toast";
import type { ScheduleTeacher } from "../../types/entities";

interface EditPayload {
  newScheduleData: Partial<ScheduleTeacher>;
  id?: number;
}

export function useEditScheduleTeacher() {
  const queryClient = useQueryClient();

  const { mutate: editScheduleTeacher, isPending: isEditing } = useMutation<any, any, EditPayload>({
    mutationFn: ({ newScheduleData, id }: EditPayload) =>
      createEditScheduleTeachers(newScheduleData, id),
    onSuccess: () => {
      toast.success("Horario de actividad actualizado correctamente");
      queryClient.invalidateQueries({ queryKey: ["scheduleTeachers"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return { isEditing, editScheduleTeacher };
}
