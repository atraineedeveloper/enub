import { useQuery } from "@tanstack/react-query";
import { useUser } from "../authentication/useUser";
import { useProfile } from "../authentication/useProfile";
import {
  buildMyScheduleTeacherActivitiesQueryOptions,
  canRunMyScheduleQuery,
  resolveMyScheduleTeacherActivitiesSnapshot,
  type ScheduleQueryIdentity,
} from "./workerScheduleQuery";

// Identity (authUserId, workerId) is derived here from the authenticated
// session/profile path (useUser/useProfile) -- never accepted as a prop
// from a page or the URL. See workerScheduleQuery.ts for the
// account-generation-safety rationale.
export function useMyScheduleTeacherActivities(semesterId: number | undefined) {
  const { user, isLoading: isLoadingUser } = useUser();
  const { workerId, isLoading: isLoadingProfile } = useProfile();
  const authUserId = user?.id ?? null;

  const gated = canRunMyScheduleQuery({
    authUserId,
    workerId,
    semesterId: semesterId ?? null,
  });

  const { queryKey, queryFn } = buildMyScheduleTeacherActivitiesQueryOptions(
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

  const scheduleTeacherActivities = resolveMyScheduleTeacherActivitiesSnapshot(
    query.data,
    currentIdentity
  );

  const isLoading =
    isLoadingUser ||
    isLoadingProfile ||
    (gated && scheduleTeacherActivities === undefined && !query.isError);

  return { isLoading, error: query.error, scheduleTeacherActivities };
}
