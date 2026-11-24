import type { CreateEditWorkerOptions } from "../../types/workerMutation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditWorkers } from "../../services/apiWorkers";
import { toast } from "react-hot-toast";

interface CreateWorkerVariables {
  newWorker: Record<string, unknown>;
  options?: CreateEditWorkerOptions;
}

export function useCreateWorker() {
  const queryClient = useQueryClient();

  const { mutate: createWorker, isPending: isCreating } = useMutation({
    mutationFn: ({ newWorker, options }: CreateWorkerVariables) =>
      createEditWorkers(newWorker, undefined, options),
    onSuccess: () => {
      toast.success("El trabajador se creó con éxito");
      queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return { isCreating, createWorker };
}
