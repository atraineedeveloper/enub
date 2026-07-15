import { useQuery } from "@tanstack/react-query";
import { getWorkerAccessEmailContext } from "../../services/apiProfiles";

// Used only by the "Actualizar correo de acceso" confirmation dialog, to
// display the worker's current linked Auth login email (masked by
// default, full on explicit reveal). `enabled` should be gated by both
// admin role and the dialog's own open state by the caller.
export function useWorkerAccessEmailContext(
  workerId: number,
  { reveal, enabled }: { reveal?: boolean; enabled: boolean }
) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["worker-access-email-context", workerId, reveal ?? false],
    queryFn: () => getWorkerAccessEmailContext({ workerId, reveal }),
    enabled,
  });

  return {
    context: data,
    isLoadingContext: isLoading,
    contextError: error as Error | null,
  };
}
