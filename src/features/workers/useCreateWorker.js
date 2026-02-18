import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditWorkers } from "../../services/apiWorkers";
import { toast } from "react-hot-toast";

export function useCreateWorker() {
  const queryClient = useQueryClient();

  const { mutate: createWorker, isLoading: isCreating } = useMutation({
    mutationFn: ({ newWorker, options }) =>
      createEditWorkers(newWorker, undefined, options),
    onSuccess: () => {
      toast.success("El trabajador se creó con éxito");
      queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return { isCreating, createWorker };
}
