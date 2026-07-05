import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditWorkers } from "../../services/apiWorkers";
import { toast } from "react-hot-toast";

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

// createEditWorkers is untyped JS (out of scope); TS infers its `options`
// param narrowly from the destructured defaults (e.g. `profilePictureFile =
// null` implies `null`, not `File | null`). This cast describes the real,
// accepted shape without converting apiWorkers.js.
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
      toast.success("El registro se actualizó con éxito");
      queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return { isEditing, editWorker };
}
