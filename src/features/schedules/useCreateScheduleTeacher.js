import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { createEditScheduleTeachers } from "../../services/apiScheduleTeachers";

export function useCreateScheduleTeacher() {
  const queryClient = useQueryClient();

  const { mutate: createScheduleTeacher, isLoading: isCreating } = useMutation({
    mutationFn: createEditScheduleTeachers,
    onSuccess: () => {
      toast.success("El registro se creó correctamente");
      queryClient.invalidateQueries({ queryKey: ["scheduleTeachers"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return { isCreating, createScheduleTeacher };
}
