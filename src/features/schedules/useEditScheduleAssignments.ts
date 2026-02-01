import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditScheduleAssignments } from "../../services/apiScheduleAssignments";
import { toast } from "react-hot-toast";

export function useEditScheduleAssignment() {
  const queryClient = useQueryClient();

  const { mutate: editScheduleAssignment, isPending: isEditing } = useMutation({
    mutationFn: ({ newScheduleAssignment, id }: { newScheduleAssignment: any; id: number }) =>
      createEditScheduleAssignments(newScheduleAssignment, id),
    onSuccess: () => {
      toast.success("El registro se actualizó con éxito");
      queryClient.invalidateQueries({ queryKey: ["scheduleAssignments"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { isEditing, editScheduleAssignment };
}
