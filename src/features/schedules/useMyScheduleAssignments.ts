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

  const gated = canRunMyScheduleQuery({
    authUserId,
    workerId,
    semesterId: semesterId ?? null,
  });

  const { queryKey, queryFn } = buildMyScheduleAssignmentsQueryOptions(
    gated ? (authUserId as string) : "",
    gated ? (workerId as number) : -1,
    gated ? (semesterId as number) : -1
  );

  const query = useQuery({
    queryKey,
    queryFn,
    staleTime: 30 * 1000,
    enabled: gated,
  });

  const currentIdentity: ScheduleQueryIdentity | null = gated
    ? { authUserId: authUserId as string, workerId: workerId as number, semesterId: semesterId as number }
    : null;

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
