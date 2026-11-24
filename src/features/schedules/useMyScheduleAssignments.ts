import { useQuery } from "@tanstack/react-query";
import { useUser } from "../authentication/useUser";
import { useProfile } from "../authentication/useProfile";
import {
  buildMyScheduleAssignmentsQueryOptions,
  canRunMyScheduleQuery,
  resolveMyScheduleAssignmentsSnapshot,
  type ScheduleQueryIdentity,
} from "./workerScheduleQuery";

// Identity (authUserId, workerId) is derived here from the authenticated
// session/profile path (useUser/useProfile) -- never accepted as a prop
// from a page or the URL. See workerScheduleQuery.ts for the
// account-generation-safety rationale.
export function useMyScheduleAssignments(semesterId: number | undefined) {
  const { user, isLoading: isLoadingUser } = useUser();
  const { workerId, isLoading: isLoadingProfile } = useProfile();
  const authUserId = user?.id ?? null;

  const identity = { authUserId, workerId, semesterId: semesterId ?? null };
  const currentIdentity: ScheduleQueryIdentity | null = canRunMyScheduleQuery(identity)
    ? identity
    : null;
  const gated = currentIdentity !== null;

  const { queryKey, queryFn } = buildMyScheduleAssignmentsQueryOptions(
    currentIdentity?.authUserId ?? "",
    currentIdentity?.workerId ?? -1,
    currentIdentity?.semesterId ?? -1
  );

  const query = useQuery({
    queryKey,
    queryFn,
    staleTime: 30 * 1000,
    enabled: gated,
  });

  const scheduleAssignments = resolveMyScheduleAssignmentsSnapshot(
    query.data,
    currentIdentity
  );

  // Still "loading" whenever gated but the resolved-for-this-generation
  // data isn't in yet -- covers both the ordinary pending case and a stale
  // snapshot from a prior generation being discarded above.
  const isLoading =
    isLoadingUser || isLoadingProfile || (gated && scheduleAssignments === undefined && !query.isError);

  return { isLoading, error: query.error, scheduleAssignments };
}
