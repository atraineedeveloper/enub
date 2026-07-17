import { isValidWorkerId } from "../authentication/workerLinkValidation";
import {
  getMyScheduleAssignments,
  getMyScheduleTeacherActivities,
} from "../../services/apiWorkerSchedule";
import type {
  RawWorkerScheduleAssignmentRow,
  RawWorkerScheduleTeacherRow,
} from "./workerScheduleEntry";

// Account-generation-safe query layer for the two worker schedule reads
// (design.md §6 predates this; this module follows the same proven
// pattern useCurrentIdentity.ts already established for the header's
// worker-identity lookup): every query key is bound to the exact
// authenticated user AND validated worker AND semester it was built for, so
// switching accounts (or a stale in-flight request from a previous account)
// can never surface one account's schedule data under another account's
// active render. RLS remains the authorization authority throughout --
// this layer only prevents a client-side cache/race mistake from *looking*
// like cross-account data leakage; it grants no access RLS wouldn't already
// grant or deny on its own.

export function isValidSemesterId(semesterId: unknown): semesterId is number {
  return (
    typeof semesterId === "number" &&
    Number.isFinite(semesterId) &&
    Number.isInteger(semesterId) &&
    semesterId > 0
  );
}

export interface ScheduleQueryIdentity {
  authUserId: string;
  workerId: number;
  semesterId: number;
}

// Shared gate for both schedule queries: a non-empty authUserId, a
// finite-positive-integer workerId (the shared validator, not a weaker
// local check), and a finite-positive-integer semesterId.
export function canRunMyScheduleQuery(input: {
  authUserId: string | null;
  workerId: number | null;
  semesterId: number | null | undefined;
}): input is ScheduleQueryIdentity {
  if (typeof input.authUserId !== "string") return false;
  if (input.authUserId.trim().length === 0) return false;
  if (!isValidWorkerId(input.workerId)) return false;
  if (!isValidSemesterId(input.semesterId)) return false;
  return true;
}

export interface MyScheduleAssignmentsSnapshot {
  forAuthUserId: string;
  forWorkerId: number;
  forSemesterId: number;
  data: RawWorkerScheduleAssignmentRow[];
}

export interface MyScheduleTeacherActivitiesSnapshot {
  forAuthUserId: string;
  forWorkerId: number;
  forSemesterId: number;
  data: RawWorkerScheduleTeacherRow[];
}

// authUserId/workerId/semesterId are captured as plain function arguments
// -- closed over before the `await` -- and stamped onto the returned
// snapshot from those captured values, never read live/ambient after the
// fetch resolves. `fetchRows` is injectable (defaulting to the real
// service call) purely so tests can exercise the actual capture/tagging
// behavior with a fake I/O boundary, matching fetchWorkerIdentitySnapshot's
// existing pattern.
export async function fetchMyScheduleAssignmentsSnapshot(
  authUserId: string,
  workerId: number,
  semesterId: number,
  fetchRows: (
    semesterId: number
  ) => Promise<RawWorkerScheduleAssignmentRow[]> = getMyScheduleAssignments
): Promise<MyScheduleAssignmentsSnapshot> {
  const data = await fetchRows(semesterId);
  return { forAuthUserId: authUserId, forWorkerId: workerId, forSemesterId: semesterId, data };
}

export async function fetchMyScheduleTeacherActivitiesSnapshot(
  authUserId: string,
  workerId: number,
  semesterId: number,
  fetchRows: (
    semesterId: number
  ) => Promise<RawWorkerScheduleTeacherRow[]> = getMyScheduleTeacherActivities
): Promise<MyScheduleTeacherActivitiesSnapshot> {
  const data = await fetchRows(semesterId);
  return { forAuthUserId: authUserId, forWorkerId: workerId, forSemesterId: semesterId, data };
}

// Exported so the exact query key/queryFn construction handed to React
// Query can be exercised directly in tests without a live QueryClient.
// "my-schedule" + "assignments"/"activities" keeps these two queries'
// cache entries disjoint from each other and from every admin schedule
// query key (which carries no authUserId/workerId at all).
export function buildMyScheduleAssignmentsQueryOptions(
  authUserId: string,
  workerId: number,
  semesterId: number
) {
  return {
    queryKey: ["my-schedule", "assignments", authUserId, workerId, semesterId] as const,
    queryFn: () => fetchMyScheduleAssignmentsSnapshot(authUserId, workerId, semesterId),
  };
}

export function buildMyScheduleTeacherActivitiesQueryOptions(
  authUserId: string,
  workerId: number,
  semesterId: number
) {
  return {
    queryKey: ["my-schedule", "activities", authUserId, workerId, semesterId] as const,
    queryFn: () => fetchMyScheduleTeacherActivitiesSnapshot(authUserId, workerId, semesterId),
  };
}

// Resolves a fetched snapshot against the CURRENT render's identity triple.
// A snapshot captured for a different authUserId/workerId/semesterId (an
// in-flight request from before an account switch, or a race with the
// generation the current render actually wants) is discarded -- treated as
// "not resolved yet" -- rather than ever being surfaced as this
// generation's data.
export function resolveMyScheduleAssignmentsSnapshot(
  snapshot: MyScheduleAssignmentsSnapshot | undefined,
  current: ScheduleQueryIdentity | null
): RawWorkerScheduleAssignmentRow[] | undefined {
  if (!current || !snapshot) return undefined;
  if (
    snapshot.forAuthUserId !== current.authUserId ||
    snapshot.forWorkerId !== current.workerId ||
    snapshot.forSemesterId !== current.semesterId
  ) {
    return undefined;
  }
  return snapshot.data;
}

export function resolveMyScheduleTeacherActivitiesSnapshot(
  snapshot: MyScheduleTeacherActivitiesSnapshot | undefined,
  current: ScheduleQueryIdentity | null
): RawWorkerScheduleTeacherRow[] | undefined {
  if (!current || !snapshot) return undefined;
  if (
    snapshot.forAuthUserId !== current.authUserId ||
    snapshot.forWorkerId !== current.workerId ||
    snapshot.forSemesterId !== current.semesterId
  ) {
    return undefined;
  }
  return snapshot.data;
}
