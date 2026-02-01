import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { deleteScheduleTeachers as deleteScheduleTeachersApi } from "../../services/apiScheduleTeachers";

export function useDeleteScheduleTeacher() {
  const queryClient = useQueryClient();

  const { isPending: isDeleting, mutate: deleteScheduleTeachers } = useMutation(
    {
      mutationFn: deleteScheduleTeachersApi,
      onSuccess: () => {
        toast.success("Horario eliminado con éxito");

        queryClient.invalidateQueries({
          queryKey: ["scheduleTeachers"],
        });
      },
      onError: (err: Error) => toast.error(err.message),
    }
  );

  return { isDeleting, deleteScheduleTeachers };
}
