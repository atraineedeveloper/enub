import { useMutation } from "@tanstack/react-query";
import { requestPasswordRecovery as requestPasswordRecoveryApi } from "../../services/apiAuth";

export function useRequestPasswordRecovery() {
  const {
    mutate: requestPasswordRecovery,
    data: outcome,
    isPending: isRequesting,
    isError,
  } = useMutation({
    mutationFn: requestPasswordRecoveryApi,
  });

  return {
    requestPasswordRecovery,
    isRequesting,
    // "submitted" is the neutral state shown for a real success *and* for
    // any Auth API error response (see the fail-closed classification in
    // apiAuth.ts's requestPasswordRecovery).
    isSuccess: outcome === "submitted",
    // "retry_later" is reserved for transport failures (offline,
    // network/DNS error, or the request never reaching the Auth API --
    // see isAuthRetryableFetchError usage in apiAuth.ts), which happen
    // identically regardless of the submitted email. `isError` covers the
    // residual case of a thrown, non-Auth exception (e.g. a genuine bug)
    // bypassing that classification entirely -- an accepted, documented
    // operational limitation rather than something to add new
    // infrastructure for.
    isRetryLater: outcome === "retry_later" || isError,
  };
}
