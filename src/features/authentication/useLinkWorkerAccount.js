import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { linkWorkerAccount } from "../../services/apiProfiles";

export function useLinkWorkerAccount() {
  const queryClient = useQueryClient();

  const { mutate: linkAccount, isPending: isLinking } = useMutation({
    mutationFn: linkWorkerAccount,
    onSuccess: () => {
      toast.success("La cuenta se vinculó con éxito");
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return { isLinking, linkAccount };
}
