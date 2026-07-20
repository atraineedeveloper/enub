import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditWorkers } from "../../services/apiWorkers";
import { toast } from "react-hot-toast";
import {
  handleWorkerEditError,
  handleWorkerEditSuccess,
} from "./workerEditFeedback";

interface EditWorkerOptions {
  profilePictureFile?: File | null;
  removeCurrentProfilePicture?: boolean;
  currentProfilePicture?: string | null;
  sustenancePlazas?: unknown[];
  dateOfAdmissions?: unknown[];
}

interface EditWorkerVariables {
  newWorker: Record<string, unknown>;
  id: number;
  options?: EditWorkerOptions;
}

const createOrEditWorker = createEditWorkers as (
  newWorker: Record<string, unknown>,
  id: number | undefined,
  options?: EditWorkerOptions
) => Promise<unknown>;

export function useEditWorker() {
  const queryClient = useQueryClient();

  const { mutate: editWorker, isPending: isEditing } = useMutation({
    mutationFn: ({ newWorker, id, options }: EditWorkerVariables) =>
      createOrEditWorker(newWorker, id, options),
    onSuccess: () => {
      handleWorkerEditSuccess(toast.success, () => {
        void queryClient.invalidateQueries({ queryKey: ["workers"] });
      });
    },
    onError: (err) => handleWorkerEditError(err, toast.error),
  });

  return { isEditing, editWorker };
}
