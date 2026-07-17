import { useProfile } from "./useProfile";
import { isValidWorkerId } from "./workerLinkValidation";

// For the rare worker page whose presentational view still needs a
// workerId prop (WorkerDocumentsView.tsx -- intentionally not modified by
// this change) rather than resolving identity internally the way
// MyScheduleView/MyProfileView now do. Returns the session-derived,
// validated workerId, or null while it's still loading/invalid -- callers
// must never fall back to treating null as "0" or otherwise coerce it.
// This is a read of the exact same useProfile() path WorkerRouteGate
// itself gates on, not a URL- or prop-supplied value, and not a second,
// independently-drifting validity check (isValidWorkerId is the single
// shared validator).
export function useGatedWorkerId(): number | null {
  const { role, workerId } = useProfile();
  return role === "worker" && isValidWorkerId(workerId) ? workerId : null;
}
