import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { createWorkerAccount } from "../../services/apiProfiles";

export function useCreateWorkerAccount() {
  const queryClient = useQueryClient();

  const { mutate: createAccount, isPending: isCreatingAccount } = useMutation({
    mutationFn: createWorkerAccount,
    onSuccess: (data) => {
      // The Edge Function's own `message` is already the exact Spanish text
      // for each status (invited / linked_existing_auth_user /
      // already_linked) -- relayed verbatim rather than duplicated here.
      toast.success(data?.message || "Cuenta creada e invitación enviada");
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["linked-worker-accounts"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return { isCreatingAccount, createAccount };
}
