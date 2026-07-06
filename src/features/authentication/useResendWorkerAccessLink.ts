import { useMutation } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { resendWorkerAccessLink } from "../../services/apiProfiles";

// No query invalidation needed here -- unlike createWorkerAccount, this
// action never creates/links a profile or changes worker data; it only
// sends an email (decisions.md #33).
export function useResendWorkerAccessLink() {
  const { mutate: resendAccessLink, isPending: isResendingAccessLink } =
    useMutation({
      mutationFn: resendWorkerAccessLink,
      onSuccess: (data) => {
        toast.success(data?.message || "Enlace de acceso reenviado");
      },
      onError: (err) => toast.error(err.message),
    });

  return { isResendingAccessLink, resendAccessLink };
}
