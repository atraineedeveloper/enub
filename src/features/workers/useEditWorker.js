import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditWorkers } from "../../services/apiWorkers";
import { toast } from "react-hot-toast";

export function useEditWorker() {
  const queryClient = useQueryClient();

  const { mutate: editWorker, isLoading: isEditing } = useMutation({
    mutationFn: ({ newWorker, id, options }) =>
      createEditWorkers(newWorker, id, options),
    onSuccess: () => {
      toast.success("El registro se actualizó con éxito");
      queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return { isEditing, editWorker };
}
