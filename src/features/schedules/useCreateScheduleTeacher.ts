import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { createEditScheduleTeachers } from "../../services/apiScheduleTeachers";
import type { ScheduleTeacher } from "../../types/entities";

export function useCreateScheduleTeacher() {
  const queryClient = useQueryClient();

  const { mutate: createScheduleTeacher, isPending: isCreating } = useMutation<
    any,
    any,
    Partial<ScheduleTeacher>
  >({
    mutationFn: createEditScheduleTeachers,
    onSuccess: () => {
      toast.success("El registro se creó correctamente");
      queryClient.invalidateQueries({ queryKey: ["scheduleTeachers"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return { isCreating, createScheduleTeacher };
}
