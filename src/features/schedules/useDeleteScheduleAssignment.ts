import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { deleteScheduleAssignment as deleteScheduleAssignmentApi } from "../../services/apiScheduleAssignments";

export function useDeleteScheduleAssignment() {
  const queryClient = useQueryClient();

  const { isPending: isDeleting, mutate: deleteScheduleAssignment } =
    useMutation({
      mutationFn: deleteScheduleAssignmentApi,
      onSuccess: () => {
        toast.success("Horario eliminado con éxito");

        queryClient.invalidateQueries({
          queryKey: ["scheduleAssignments"],
        });
      },
      onError: (err: Error) => toast.error(err.message),
    });

  return { isDeleting, deleteScheduleAssignment };
}
