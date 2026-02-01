import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditWorkers } from "../../services/apiWorkers";
import { toast } from "react-hot-toast";

export function useEditWorker() {
  const queryClient = useQueryClient();

  const { mutate: editWorker, isPending: isEditing } = useMutation({
    mutationFn: ({ newWorker, id }: { newWorker: any; id: number }) => createEditWorkers(newWorker, id),
    onSuccess: () => {
      toast.success("El registro se actualizó con éxito");
      queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { isEditing, editWorker };
}
