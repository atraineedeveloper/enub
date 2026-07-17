// Single source of truth for "is this a usable worker_id" -- a finite,
// integral, positive number. Previously duplicated (with weaker variants
// such as `workerId != null`, which admits 0/negative/NaN/Infinity) across
// useCurrentIdentity.ts, WorkerRouteGate.tsx, and the schedule/profile query
// layers. Lives here (authentication/profile-identity territory) rather
// than in a schedules/workers feature module so every one of those callers
// can import it without risking a circular import back into this module.
export function isValidWorkerId(workerId: unknown): workerId is number {
  return (
    typeof workerId === "number" &&
    Number.isFinite(workerId) &&
    Number.isInteger(workerId) &&
    workerId > 0
  );
}
