import { useQuery } from "@tanstack/react-query";
import { useUser } from "./useUser";
import { useProfile } from "./useProfile";
import {
  getWorkerIdentityById,
  getProfilePicturePublicUrl,
  type WorkerIdentityRow,
} from "../../services/apiWorkers";
import { getInitials, nameFromEmail } from "../../ui/avatarIdentity";

export type Role = "admin" | "staff" | "worker";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  staff: "Personal administrativo",
  worker: "Docente",
};

// Used whenever no worker name and no usable email local-part exist, so the
// header never shows a blank display name, a blank accessible trigger
// label, or an empty popover heading.
export const FALLBACK_DISPLAY_NAME = "Usuario";

export interface IdentityReady {
  status: "ready";
  role: Role;
  roleLabel: string;
  displayName: string;
  isNameFallback: boolean;
  avatarUrl: string | null;
  initials: string;
}

export type IdentityState =
  | { status: "loading" }
  | IdentityReady
  | { status: "incomplete" }
  | { status: "denied" }
  | { status: "profile-error" }
  | { status: "worker-error" };

// Worker-record lookup is enabled only when the profile query succeeded,
// the role is exactly "worker", authUserId is a non-empty valid string, and
// workerId is a finite positive integer. admin/staff always short-circuit
// on the role check before any other check runs, so they can never trigger
// a worker fetch.
export function canFetchWorkerIdentity(input: {
  profileSucceeded: boolean;
  role: string | null;
  authUserId: string | null;
  workerId: number | null;
}): boolean {
  if (!input.profileSucceeded) return false;
  if (input.role !== "worker") return false;
  if (typeof input.authUserId !== "string") return false;
  if (input.authUserId.trim().length === 0) return false;
  if (typeof input.workerId !== "number") return false;
  if (!Number.isFinite(input.workerId)) return false;
  if (!Number.isInteger(input.workerId)) return false;
  if (input.workerId <= 0) return false;
  return true;
}

// --- Pure, generation-guarded resolver -------------------------------
// Kept independent of React/React Query so the current-user/profile-
// generation invariant is unit-testable as a resolver/state-snapshot test,
// not a full integration test. See design.md §5.

export interface ProfileSnapshot {
  authUserId: string | null;
  status: "loading" | "error" | "success";
  role: string | null;
  workerId: number | null;
}

export interface WorkerQuerySnapshot {
  // The exact inputs active when this worker-query result was produced --
  // a result is only trusted when these match the CURRENT profile snapshot.
  forAuthUserId: string;
  forWorkerId: number;
  status: "loading" | "success" | "error";
  data: WorkerIdentityRow | null;
}

export type IdentityResolution =
  | { status: "loading" }
  | { status: "incomplete" }
  | { status: "denied" }
  | { status: "profile-error" }
  | { status: "worker-error" }
  | { status: "ready"; role: Role; source: "fallback" }
  | {
      status: "ready";
      role: Role;
      source: "worker-row";
      worker: WorkerIdentityRow;
    };

export function resolveIdentityState(
  profile: ProfileSnapshot,
  worker: WorkerQuerySnapshot | null
): IdentityResolution {
  if (profile.status === "loading") return { status: "loading" };
  if (profile.status === "error") return { status: "profile-error" };

  // profile.status === "success" from here on.
  if (profile.role === null) return { status: "incomplete" };

  if (
    profile.role !== "admin" &&
    profile.role !== "staff" &&
    profile.role !== "worker"
  ) {
    return { status: "denied" };
  }

  if (profile.role === "admin" || profile.role === "staff") {
    return { status: "ready", role: profile.role, source: "fallback" };
  }

  // profile.role === "worker" from here on.
  const gated = canFetchWorkerIdentity({
    profileSucceeded: true,
    role: profile.role,
    authUserId: profile.authUserId,
    workerId: profile.workerId,
  });

  // Invalid/missing linkage: the profile claims a worker identity but has
  // nothing valid to resolve it from -- incomplete, never a fallback
  // identity (distinct from a valid link whose row lookup finds nothing).
  if (!gated) return { status: "incomplete" };

  // Generation guard: a worker-query snapshot is only trusted when it was
  // produced for this exact authenticated user id and this exact workerId.
  // A stale snapshot from a different generation is treated as though no
  // result exists yet.
  const belongsToCurrentGeneration =
    worker !== null &&
    profile.authUserId !== null &&
    worker.forAuthUserId === profile.authUserId &&
    worker.forWorkerId === profile.workerId;

  const effectiveWorker = belongsToCurrentGeneration ? worker : null;

  if (effectiveWorker === null) return { status: "loading" };
  if (effectiveWorker.status === "loading") return { status: "loading" };
  if (effectiveWorker.status === "error") return { status: "worker-error" };

  // effectiveWorker.status === "success" from here on.
  if (effectiveWorker.data !== null) {
    return {
      status: "ready",
      role: "worker",
      source: "worker-row",
      worker: effectiveWorker.data,
    };
  }

  // Valid workerId, lookup succeeded, no matching row.
  return { status: "ready", role: "worker", source: "fallback" };
}

// Exported for direct unit testing of the display-name/avatar/initials
// resolution rules (worker row found with a usable name vs. every other
// case falling back to the email local-part).
export function enrichResolution(
  resolution: IdentityResolution,
  context: { email: string | null }
): IdentityState {
  if (resolution.status !== "ready") return resolution;

  const roleLabel = ROLE_LABELS[resolution.role];

  if (resolution.source === "worker-row") {
    const rawName = resolution.worker.name?.trim();
    if (rawName) {
      const avatarUrl = resolution.worker.profile_picture
        ? getProfilePicturePublicUrl(resolution.worker.profile_picture) ||
          null
        : null;

      return {
        status: "ready",
        role: resolution.role,
        roleLabel,
        displayName: rawName,
        isNameFallback: false,
        avatarUrl,
        initials: getInitials(rawName),
      };
    }
    // Row found but no usable name -- falls through to the same
    // email-local-part fallback as a missing row / admin / staff.
  }

  // Covers: no email at all, an empty email, a malformed email with no
  // usable local part (e.g. "@example.com"), and a whitespace-only email --
  // all of which nameFromEmail reduces to "". Never display a blank name,
  // a blank accessible trigger label, or an empty popover heading.
  const emailDerivedName = context.email ? nameFromEmail(context.email) : "";
  const fallbackName = emailDerivedName || FALLBACK_DISPLAY_NAME;

  return {
    status: "ready",
    role: resolution.role,
    roleLabel,
    displayName: fallbackName,
    isNameFallback: true,
    avatarUrl: null,
    initials: getInitials(fallbackName),
  };
}

// The query's own result payload -- not any ambient/current-render
// variable -- is the source of truth for which generation (authUserId +
// workerId) a successful fetch belongs to. `fetchWorkerIdentitySnapshot`
// captures both at the moment the request is built (its own arguments,
// closed over by the caller before any `await`), so a result already in
// flight keeps the generation it started with even if the current render's
// authUserId/workerId move on before the promise settles.
export interface WorkerIdentityFetchResult {
  forAuthUserId: string;
  forWorkerId: number;
  data: WorkerIdentityRow | null;
}

// `fetchWorkerRow` is injectable (defaulting to the real service call) so
// tests can exercise this function's actual capture/tagging behavior with
// a fake I/O boundary, without mocking Supabase or making a real network
// call.
export async function fetchWorkerIdentitySnapshot(
  authUserId: string,
  workerId: number,
  fetchWorkerRow: (id: number) => Promise<WorkerIdentityRow | null> = getWorkerIdentityById
): Promise<WorkerIdentityFetchResult> {
  const data = await fetchWorkerRow(workerId);
  return { forAuthUserId: authUserId, forWorkerId: workerId, data };
}

// Exported so the exact query key/queryFn construction React Query is
// handed can be exercised directly in tests without a live QueryClient --
// e.g. asserting two different authUserIds for the same workerId produce
// distinct keys. Not a React Query integration test: no QueryClient runs
// here, only the plain object this function returns.
export function buildWorkerIdentityQueryOptions(
  authUserId: string,
  workerId: number
) {
  return {
    queryKey: ["worker-identity", authUserId, workerId] as const,
    queryFn: () => fetchWorkerIdentitySnapshot(authUserId, workerId),
  };
}

export function useCurrentIdentity(): IdentityState {
  const { user, isLoading: isLoadingUser } = useUser();
  const {
    isLoading: isLoadingProfile,
    isError: isProfileError,
    role,
    workerId,
  } = useProfile();

  const authUserId = user?.id ?? null;

  const profileStatus: ProfileSnapshot["status"] =
    isLoadingUser || isLoadingProfile
      ? "loading"
      : isProfileError
        ? "error"
        : "success";

  const gatedThisRender = canFetchWorkerIdentity({
    profileSucceeded: profileStatus === "success",
    role: profileStatus === "success" ? role : null,
    authUserId: profileStatus === "success" ? authUserId : null,
    workerId: profileStatus === "success" ? workerId : null,
  });

  // The query key binds the fetch to this exact authenticated user, not
  // just this workerId -- two different users who happen to resolve the
  // same workerId get distinct cache entries, so React Query itself can
  // never hand back one user's cached result for another user's key.
  const { queryKey, queryFn } = buildWorkerIdentityQueryOptions(
    gatedThisRender ? (authUserId as string) : "",
    gatedThisRender ? (workerId as number) : -1
  );

  const workerQuery = useQuery({
    queryKey,
    queryFn,
    enabled: gatedThisRender,
  });

  // The success-status tag is read FROM the query's own captured result
  // payload (queryFn's return value), never stamped from the current
  // render's authUserId/workerId after the fact -- that's what makes the
  // generation guard in resolveIdentityState meaningful rather than a
  // tautology. While still loading (no payload yet) or gating is off,
  // there is nothing to mistag, so the current render's own values are a
  // safe placeholder: the resolver only branches on `status` in that case.
  const workerSnapshot: WorkerQuerySnapshot | null = gatedThisRender
    ? {
        forAuthUserId: workerQuery.data?.forAuthUserId ?? (authUserId as string),
        forWorkerId: workerQuery.data?.forWorkerId ?? (workerId as number),
        status:
          workerQuery.status === "pending"
            ? "loading"
            : workerQuery.status === "error"
              ? "error"
              : "success",
        data: workerQuery.data?.data ?? null,
      }
    : null;

  const resolution = resolveIdentityState(
    { authUserId, status: profileStatus, role, workerId },
    workerSnapshot
  );

  return enrichResolution(resolution, { email: user?.email ?? null });
}
