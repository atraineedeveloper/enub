import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  updateWorkerAccessEmail,
  type WorkerAccessEmailCorrectionResult,
} from "../../services/apiProfiles";

// Outcomes rejected before any side effect took place (tasks.md §12.2): no
// cache invalidation is needed for these. Matched by the (status,
// reasonCode) pair, not reasonCode alone -- "duplicate_worker_email" is
// ambiguous on its own: it is both this pre-check status's own reasonCode
// AND a possible reasonCode of manual_attention_required reached mid-sync
// (after Auth may already have been updated), which DOES need invalidation.
function isPreSideEffectRejection(
  result: WorkerAccessEmailCorrectionResult
): boolean {
  if (result.status === "invalid_email") return true;
  if (result.status === "duplicate_worker_email") return true;
  if (result.status === "correction_already_in_progress") return true;
  if (
    result.status === "manual_attention_required" &&
    result.reasonCode === "manual_attention_blocking"
  ) {
    return true;
  }
  return false;
}

// This hook only invalidates caches and surfaces genuinely unexpected
// errors via toast -- the dialog itself (not a toast) owns rendering every
// documented status/reasonCode, since several outcomes (retryable-pending,
// manual_attention_required) need persistent, readable UI rather than a
// transient toast (tasks.md 12.5).
export function useUpdateWorkerAccessEmail() {
  const queryClient = useQueryClient();

  const {
    mutate: updateAccessEmail,
    mutateAsync: updateAccessEmailAsync,
    isPending: isUpdatingAccessEmail,
    data,
    reset: resetUpdateAccessEmail,
  } = useMutation<
    WorkerAccessEmailCorrectionResult,
    Error,
    { workerId: number; newEmail: string }
  >({
    mutationFn: updateWorkerAccessEmail,
    onSuccess: (result) => {
      if (!isPreSideEffectRejection(result)) {
        queryClient.invalidateQueries({ queryKey: ["workers"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["linked-worker-accounts"] });
        queryClient.invalidateQueries({
          queryKey: ["worker-access-email-context", result.workerId],
        });
      }
    },
    onError: (err) => toast.error(err.message),
  });

  return {
    isUpdatingAccessEmail,
    updateAccessEmail,
    updateAccessEmailAsync,
    updateAccessEmailResult: data,
    resetUpdateAccessEmail,
  };
}
