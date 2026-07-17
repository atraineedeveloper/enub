import { useQuery } from "@tanstack/react-query";
import { useUser } from "../authentication/useUser";
import { useProfile } from "../authentication/useProfile";
import {
  buildMyWorkerProfileQueryOptions,
  canFetchMyWorkerProfile,
  resolveMyWorkerProfileSnapshot,
  type ProfileQueryIdentity,
} from "./workerProfileQuery";

// Identity (authUserId, workerId) is derived here from the authenticated
// session/profile path (useUser/useProfile) -- never accepted as a prop
// from a page or the URL. See workerProfileQuery.ts for the
// account-generation-safety rationale.
export function useMyWorkerProfile() {
  const { user, isLoading: isLoadingUser } = useUser();
  const { workerId, isLoading: isLoadingProfile } = useProfile();
  const authUserId = user?.id ?? null;

  const gated = canFetchMyWorkerProfile({ authUserId, workerId });

  const { queryKey, queryFn } = buildMyWorkerProfileQueryOptions(
    gated ? (authUserId as string) : "",
    gated ? (workerId as number) : -1
  );

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: gated,
  });

  const currentIdentity: ProfileQueryIdentity | null = gated
    ? { authUserId: authUserId as string, workerId: workerId as number }
    : null;

  const resolution = resolveMyWorkerProfileSnapshot(query.data, currentIdentity);

  const isLoading =
    isLoadingUser || isLoadingProfile || (gated && resolution.status === "pending" && !query.isError);

  const myWorkerProfile = resolution.status === "resolved" ? resolution.profile : null;

  return { isLoading, error: query.error, myWorkerProfile };
}
