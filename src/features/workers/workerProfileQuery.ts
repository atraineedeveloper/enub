import { isValidWorkerId } from "../authentication/workerLinkValidation";
import { getMyWorkerProfile, type MyWorkerProfile } from "../../services/apiWorkers";

// Account-generation-safe query layer for "Mi información", mirroring
// workerScheduleQuery.ts / useCurrentIdentity.ts's proven pattern: the
// query key and the fetched snapshot are both bound to the exact
// authenticated user AND validated worker they were built for, so an
// account switch (or a stale in-flight request from a previous account)
// can never surface one worker's profile under another account's active
// render. The eight-column projection itself (see apiWorkers.ts) is
// unchanged by this layer.

export interface ProfileQueryIdentity {
  authUserId: string;
  workerId: number;
}

export function canFetchMyWorkerProfile(input: {
  authUserId: string | null;
  workerId: number | null;
}): input is ProfileQueryIdentity {
  if (typeof input.authUserId !== "string") return false;
  if (input.authUserId.trim().length === 0) return false;
  if (!isValidWorkerId(input.workerId)) return false;
  return true;
}

export interface MyWorkerProfileSnapshot {
  forAuthUserId: string;
  forWorkerId: number;
  data: MyWorkerProfile | null;
}

// authUserId/workerId are captured as plain function arguments -- closed
// over before the `await` -- and stamped onto the returned snapshot from
// those captured values, never read live/ambient after the fetch
// resolves. `fetchProfile` is injectable (defaulting to the real service
// call) so tests can exercise the real capture/tagging logic with a fake
// I/O boundary.
export async function fetchMyWorkerProfileSnapshot(
  authUserId: string,
  workerId: number,
  fetchProfile: (id: number) => Promise<MyWorkerProfile | null> = getMyWorkerProfile
): Promise<MyWorkerProfileSnapshot> {
  const data = await fetchProfile(workerId);
  return { forAuthUserId: authUserId, forWorkerId: workerId, data };
}

// "my-worker-profile" + authUserId + workerId keeps this account-sensitive
// -- two different authenticated users who happen to resolve the same
// workerId (should never legitimately happen, but is not something this
// cache key should ever have to trust) get disjoint cache entries.
export function buildMyWorkerProfileQueryOptions(authUserId: string, workerId: number) {
  return {
    queryKey: ["my-worker-profile", authUserId, workerId] as const,
    queryFn: () => fetchMyWorkerProfileSnapshot(authUserId, workerId),
  };
}

// Resolves a fetched snapshot against the CURRENT render's identity pair.
// A snapshot captured for a different authUserId/workerId is discarded --
// treated as "not resolved yet" -- rather than ever being surfaced as this
// generation's data. Returns a nested Optional shape (not just `| undefined`)
// because a resolved-but-missing-row result (`data: null`, a genuine,
// trusted "no such worker row") must stay distinguishable from
// not-yet-resolved/stale (no snapshot to trust yet).
export type MyWorkerProfileResolution =
  | { status: "pending" }
  | { status: "resolved"; profile: MyWorkerProfile | null };

export function resolveMyWorkerProfileSnapshot(
  snapshot: MyWorkerProfileSnapshot | undefined,
  current: ProfileQueryIdentity | null
): MyWorkerProfileResolution {
  if (!current || !snapshot) return { status: "pending" };
  if (snapshot.forAuthUserId !== current.authUserId || snapshot.forWorkerId !== current.workerId) {
    return { status: "pending" };
  }
  return { status: "resolved", profile: snapshot.data };
}
