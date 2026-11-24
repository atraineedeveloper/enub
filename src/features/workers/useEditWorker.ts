import type { CreateEditWorkerOptions } from "../../types/workerMutation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditWorkers } from "../../services/apiWorkers";
import { toast } from "react-hot-toast";
import {
  handleWorkerEditError,
  handleWorkerEditSuccess,
} from "./workerEditFeedback";

interface EditWorkerVariables {
  newWorker: Record<string, unknown>;
  id: number;
  options?: CreateEditWorkerOptions;
}

export function useEditWorker() {
  const queryClient = useQueryClient();

  const { mutate: editWorker, isPending: isEditing } = useMutation({
    mutationFn: ({ newWorker, id, options }: EditWorkerVariables) =>
      createEditWorkers(newWorker, id, options),
    onSuccess: () => {
      handleWorkerEditSuccess(toast.success, () => {
        void queryClient.invalidateQueries({ queryKey: ["workers"] });
      });
    },
    onError: (err) => handleWorkerEditError(err, toast.error),
  });

  return { isEditing, editWorker };
}
