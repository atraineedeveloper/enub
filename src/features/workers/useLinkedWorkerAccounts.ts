import { useQuery } from "@tanstack/react-query";
import { getLinkedWorkerIds } from "../../services/apiProfiles";
import { useProfile } from "../authentication/useProfile";

// Only fetched for admins -- this is the only role that sees the
// account-action menu items this data drives.
export function useLinkedWorkerAccounts() {
  const { isAdmin } = useProfile();

  // Widened from `number[]` to match apiProfiles.ts's real return type: the
  // `profiles.worker_id` column is nullable in the generated Database types,
  // so `getLinkedWorkerIds()` genuinely returns `(number | null)[]` -- the
  // `data ?? []` / `new Set(...)` handling below already tolerates this with
  // no behavior change.
  const { data, isLoading } = useQuery<(number | null)[]>({
    queryKey: ["linked-worker-accounts"],
    queryFn: getLinkedWorkerIds,
    enabled: isAdmin,
  });

  return {
    isLoading: isAdmin && isLoading,
    linkedWorkerIds: new Set(data ?? []),
  };
}
