import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditWorkers } from "../../services/apiWorkers";
import { toast } from "react-hot-toast";

interface CreateWorkerOptions {
  profilePictureFile?: File | null;
  removeCurrentProfilePicture?: boolean;
  currentProfilePicture?: string | null;
  sustenancePlazas?: unknown[];
  dateOfAdmissions?: unknown[];
}

interface CreateWorkerVariables {
  newWorker: Record<string, unknown>;
  options?: CreateWorkerOptions;
}

// createEditWorkers is untyped JS (out of scope); TS infers its `options`
// param narrowly from the destructured defaults (e.g. `profilePictureFile =
// null` implies `null`, not `File | null`). This cast describes the real,
// accepted shape without converting apiWorkers.js.
const createOrEditWorker = createEditWorkers as (
  newWorker: Record<string, unknown>,
  id: number | undefined,
  options?: CreateWorkerOptions
) => Promise<unknown>;

export function useCreateWorker() {
  const queryClient = useQueryClient();

  const { mutate: createWorker, isPending: isCreating } = useMutation({
    mutationFn: ({ newWorker, options }: CreateWorkerVariables) =>
      createOrEditWorker(newWorker, undefined, options),
    onSuccess: () => {
      toast.success("El trabajador se creó con éxito");
      queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return { isCreating, createWorker };
}
