import { useQuery } from "@tanstack/react-query";
import { getLinkedWorkerIds } from "../../services/apiProfiles";
import { useProfile } from "../authentication/useProfile";

// Only fetched for admins -- this is the only role that sees the
// account-action menu items this data drives.
export function useLinkedWorkerAccounts() {
  const { isAdmin } = useProfile();

  const { data, isLoading } = useQuery({
    queryKey: ["linked-worker-accounts"],
    queryFn: getLinkedWorkerIds,
    enabled: isAdmin,
  });

  return {
    isLoading: isAdmin && isLoading,
    linkedWorkerIds: new Set(data ?? []),
  };
}
