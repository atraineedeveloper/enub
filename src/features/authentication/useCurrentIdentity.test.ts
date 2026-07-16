import { describe, expect, test } from "bun:test";
import {
  buildWorkerIdentityQueryOptions,
  canFetchWorkerIdentity,
  enrichResolution,
  fetchWorkerIdentitySnapshot,
  resolveIdentityState,
  FALLBACK_DISPLAY_NAME,
  type ProfileSnapshot,
  type WorkerQuerySnapshot,
} from "./useCurrentIdentity";

const successfulProfile = (
  overrides: Partial<ProfileSnapshot> = {}
): ProfileSnapshot => ({
  authUserId: "user-a",
  status: "success",
  role: null,
  workerId: null,
  ...overrides,
});

describe("canFetchWorkerIdentity (strict worker-query gating)", () => {
  test("admin never fetches", () => {
    expect(
      canFetchWorkerIdentity({
        profileSucceeded: true,
        role: "admin",
        authUserId: "user-a",
        workerId: 7,
      })
    ).toBe(false);
  });

  test("staff never fetches", () => {
    expect(
      canFetchWorkerIdentity({
        profileSucceeded: true,
        role: "staff",
        authUserId: "user-a",
        workerId: 7,
      })
    ).toBe(false);
  });

  test("worker with a missing id does not fetch", () => {
    expect(
      canFetchWorkerIdentity({
        profileSucceeded: true,
        role: "worker",
        authUserId: "user-a",
        workerId: null,
      })
    ).toBe(false);
  });

  test("worker with id 0 does not fetch", () => {
    expect(
      canFetchWorkerIdentity({
        profileSucceeded: true,
        role: "worker",
        authUserId: "user-a",
        workerId: 0,
      })
    ).toBe(false);
  });

  test("worker with a negative id does not fetch", () => {
    expect(
      canFetchWorkerIdentity({
        profileSucceeded: true,
        role: "worker",
        authUserId: "user-a",
        workerId: -5,
      })
    ).toBe(false);
  });

  test("worker with a non-integer id does not fetch", () => {
    expect(
      canFetchWorkerIdentity({
        profileSucceeded: true,
        role: "worker",
        authUserId: "user-a",
        workerId: 4.5,
      })
    ).toBe(false);
  });

  test("worker with NaN id does not fetch", () => {
    expect(
      canFetchWorkerIdentity({
        profileSucceeded: true,
        role: "worker",
        authUserId: "user-a",
        workerId: NaN,
      })
    ).toBe(false);
  });

  test("worker with an infinite id does not fetch", () => {
    expect(
      canFetchWorkerIdentity({
        profileSucceeded: true,
        role: "worker",
        authUserId: "user-a",
        workerId: Infinity,
      })
    ).toBe(false);
  });

  test("a profile that has not yet succeeded never fetches, even with a valid id", () => {
    expect(
      canFetchWorkerIdentity({
        profileSucceeded: false,
        role: "worker",
        authUserId: "user-a",
        workerId: 7,
      })
    ).toBe(false);
  });

  test("worker with a missing authUserId does not fetch, even with a valid id", () => {
    expect(
      canFetchWorkerIdentity({
        profileSucceeded: true,
        role: "worker",
        authUserId: null,
        workerId: 7,
      })
    ).toBe(false);
  });

  test("worker with an empty-string authUserId does not fetch", () => {
    expect(
      canFetchWorkerIdentity({
        profileSucceeded: true,
        role: "worker",
        authUserId: "",
        workerId: 7,
      })
    ).toBe(false);
  });

  test("worker with a whitespace-only authUserId does not fetch", () => {
    expect(
      canFetchWorkerIdentity({
        profileSucceeded: true,
        role: "worker",
        authUserId: "   ",
        workerId: 7,
      })
    ).toBe(false);
  });

  test("worker with a valid positive integer id and a valid authUserId fetches", () => {
    expect(
      canFetchWorkerIdentity({
        profileSucceeded: true,
        role: "worker",
        authUserId: "user-a",
        workerId: 7,
      })
    ).toBe(true);
  });
});

describe("resolveIdentityState (full state-resolution table)", () => {
  test("loading while the profile is still resolving", () => {
    expect(
      resolveIdentityState({ authUserId: null, status: "loading", role: null, workerId: null }, null)
    ).toEqual({ status: "loading" });
  });

  test("profile-error when the profile query itself fails", () => {
    expect(
      resolveIdentityState(
        { authUserId: "user-a", status: "error", role: null, workerId: null },
        null
      )
    ).toEqual({ status: "profile-error" });
  });

  test("incomplete when there is no profiles row (role is null)", () => {
    expect(
      resolveIdentityState(successfulProfile({ role: null }), null)
    ).toEqual({ status: "incomplete" });
  });

  test("denied when the role is an unrecognized non-null value", () => {
    expect(
      resolveIdentityState(successfulProfile({ role: "manager" }), null)
    ).toEqual({ status: "denied" });
  });

  test("ready (fallback) for admin", () => {
    expect(
      resolveIdentityState(successfulProfile({ role: "admin" }), null)
    ).toEqual({ status: "ready", role: "admin", source: "fallback" });
  });

  test("ready (fallback) for staff", () => {
    expect(
      resolveIdentityState(successfulProfile({ role: "staff" }), null)
    ).toEqual({ status: "ready", role: "staff", source: "fallback" });
  });

  describe("worker role with an invalid or missing linkage -> incomplete, not ready", () => {
    test.each([
      ["missing workerId", null],
      ["zero workerId", 0],
      ["negative workerId", -3],
      ["non-integer workerId", 2.5],
      ["NaN workerId", NaN],
      ["infinite workerId", Infinity],
    ])("%s resolves to incomplete", (_label, workerId) => {
      expect(
        resolveIdentityState(
          successfulProfile({ role: "worker", workerId: workerId as number | null }),
          null
        )
      ).toEqual({ status: "incomplete" });
    });

    test("a missing authUserId also resolves to incomplete, even with an otherwise valid workerId", () => {
      expect(
        resolveIdentityState(
          successfulProfile({ authUserId: null, role: "worker", workerId: 7 }),
          null
        )
      ).toEqual({ status: "incomplete" });
    });
  });

  test("loading while a gated worker query has not resolved yet", () => {
    const profile = successfulProfile({ role: "worker", workerId: 7 });
    const worker: WorkerQuerySnapshot = {
      forAuthUserId: "user-a",
      forWorkerId: 7,
      status: "loading",
      data: null,
    };
    expect(resolveIdentityState(profile, worker)).toEqual({ status: "loading" });
  });

  test("ready (worker-row) when a valid workerId's lookup finds a row", () => {
    const profile = successfulProfile({ role: "worker", workerId: 7 });
    const worker: WorkerQuerySnapshot = {
      forAuthUserId: "user-a",
      forWorkerId: 7,
      status: "success",
      data: { name: "Ana Pérez", profile_picture: null },
    };
    expect(resolveIdentityState(profile, worker)).toEqual({
      status: "ready",
      role: "worker",
      source: "worker-row",
      worker: { name: "Ana Pérez", profile_picture: null },
    });
  });

  test("ready (fallback) when a valid workerId's lookup finds no row", () => {
    const profile = successfulProfile({ role: "worker", workerId: 7 });
    const worker: WorkerQuerySnapshot = {
      forAuthUserId: "user-a",
      forWorkerId: 7,
      status: "success",
      data: null,
    };
    expect(resolveIdentityState(profile, worker)).toEqual({
      status: "ready",
      role: "worker",
      source: "fallback",
    });
  });

  test("worker-error when a valid workerId's lookup fails at the query level", () => {
    const profile = successfulProfile({ role: "worker", workerId: 7 });
    const worker: WorkerQuerySnapshot = {
      forAuthUserId: "user-a",
      forWorkerId: 7,
      status: "error",
      data: null,
    };
    expect(resolveIdentityState(profile, worker)).toEqual({ status: "worker-error" });
  });
});

describe("resolveIdentityState (current-user/profile-generation guard)", () => {
  test("cached worker data for a different authenticated user is rejected -> loading", () => {
    const profile = successfulProfile({ authUserId: "user-b", role: "worker", workerId: 7 });
    const staleWorker: WorkerQuerySnapshot = {
      forAuthUserId: "user-a", // stale: produced for the previous user
      forWorkerId: 7,
      status: "success",
      data: { name: "Stale Name", profile_picture: null },
    };
    expect(resolveIdentityState(profile, staleWorker)).toEqual({ status: "loading" });
  });

  test("the same workerId reused across two user snapshots is not trusted until regenerated", () => {
    // Worker id 7 was previously fetched for user-a; user-b's profile now
    // also resolves to workerId 7, but the on-hand snapshot still carries
    // user-a's generation tag -- it must not be reused for user-b.
    const profileForUserB = successfulProfile({
      authUserId: "user-b",
      role: "worker",
      workerId: 7,
    });
    const snapshotFromUserA: WorkerQuerySnapshot = {
      forAuthUserId: "user-a",
      forWorkerId: 7,
      status: "success",
      data: { name: "User A's era", profile_picture: null },
    };
    expect(resolveIdentityState(profileForUserB, snapshotFromUserA)).toEqual({
      status: "loading",
    });
  });

  test("an old worker result supplied alongside a still-unresolved profile yields loading, ignoring the stale snapshot", () => {
    const loadingProfile: ProfileSnapshot = {
      authUserId: "user-b",
      status: "loading",
      role: null,
      workerId: null,
    };
    const staleWorker: WorkerQuerySnapshot = {
      forAuthUserId: "user-a",
      forWorkerId: 7,
      status: "success",
      data: { name: "Stale Name", profile_picture: null },
    };
    expect(resolveIdentityState(loadingProfile, staleWorker)).toEqual({ status: "loading" });
  });

  test("a failed logout (no account/profile change) leaves the resolved identity unchanged", () => {
    const profile = successfulProfile({ authUserId: "user-a", role: "worker", workerId: 7 });
    const worker: WorkerQuerySnapshot = {
      forAuthUserId: "user-a",
      forWorkerId: 7,
      status: "success",
      data: { name: "Ana Pérez", profile_picture: null },
    };

    const firstResolution = resolveIdentityState(profile, worker);
    // Simulates: logout mutation rejects, no cache change, no navigation --
    // calling the resolver again with the identical, unchanged snapshot
    // must yield an identical result.
    const secondResolution = resolveIdentityState(profile, worker);

    expect(secondResolution).toEqual(firstResolution);
  });

  test("a successful account change yields a neutral loading state until the new profile resolves", () => {
    // user-a was ready; user-b has just authenticated and their profile
    // query is now in flight -- no trace of user-a's identity should
    // surface even though a worker snapshot object is still passed in.
    const newAccountProfile: ProfileSnapshot = {
      authUserId: "user-b",
      status: "loading",
      role: null,
      workerId: null,
    };
    const previousAccountWorker: WorkerQuerySnapshot = {
      forAuthUserId: "user-a",
      forWorkerId: 7,
      status: "success",
      data: { name: "User A", profile_picture: null },
    };

    expect(resolveIdentityState(newAccountProfile, previousAccountWorker)).toEqual({
      status: "loading",
    });
  });
});

// These exercise the exact query-key/queryFn construction the real hook
// hands to React Query (`buildWorkerIdentityQueryOptions`,
// `fetchWorkerIdentitySnapshot`), including a real `await` for the
// capture-at-request-time property. No QueryClient is created and no
// caching/refetch/staleTime behavior is exercised, so these are NOT React
// Query integration tests -- they are runtime-representative adapter/
// helper tests: they run the actual functions the hook uses, just without
// React Query wrapped around them.
describe("buildWorkerIdentityQueryOptions / fetchWorkerIdentitySnapshot (runtime-representative, not a QueryClient integration test)", () => {
  test("user A + worker 5 and user B + worker 5 produce distinct query keys", () => {
    const optionsA = buildWorkerIdentityQueryOptions("user-a", 5);
    const optionsB = buildWorkerIdentityQueryOptions("user-b", 5);

    expect(optionsA.queryKey).toEqual(["worker-identity", "user-a", 5]);
    expect(optionsB.queryKey).toEqual(["worker-identity", "user-b", 5]);
    expect(optionsA.queryKey).not.toEqual(optionsB.queryKey);
  });

  test("cached data for user A cannot satisfy user B's query key", () => {
    // A minimal stand-in for a query cache, keyed exactly the way React
    // Query keys its internal cache (by a stable serialization of the
    // queryKey array) -- proving the key design itself, not React Query's
    // internals, is what provides the isolation.
    const cache = new Map<string, unknown>();
    const optionsA = buildWorkerIdentityQueryOptions("user-a", 5);
    const optionsB = buildWorkerIdentityQueryOptions("user-b", 5);

    cache.set(JSON.stringify(optionsA.queryKey), {
      forAuthUserId: "user-a",
      forWorkerId: 5,
      data: { name: "User A's Worker", profile_picture: null },
    });

    expect(cache.has(JSON.stringify(optionsB.queryKey))).toBe(false);
    expect(cache.get(JSON.stringify(optionsB.queryKey))).toBeUndefined();
  });

  test("a worker snapshot preserves the auth user ID captured when the request started", async () => {
    // Simulates the exact race the generation guard exists for: the
    // request is built for "user-a", and even if the caller's own local
    // notion of "current user" changes before the promise settles, the
    // resolved snapshot must still carry the ORIGINAL captured value, not
    // whatever is ambient by the time it resolves. The fake fetcher is
    // injected so this exercises the real capture/tagging logic without
    // touching Supabase.
    const fakeFetchWorkerRow = async (id: number) => ({
      name: `Worker ${id}`,
      profile_picture: null,
    });

    let ambientCurrentUser = "user-a";
    const promise = fetchWorkerIdentitySnapshot("user-a", 5, fakeFetchWorkerRow);
    ambientCurrentUser = "user-b"; // the "current user" moves on mid-flight
    const snapshot = await promise;

    expect(snapshot.forAuthUserId).toBe("user-a");
    expect(snapshot.forAuthUserId).not.toBe(ambientCurrentUser);
    expect(snapshot.forWorkerId).toBe(5);
  });

  test("changing auth user ID produces a neutral/loading state until the new user's profile and worker query resolve", async () => {
    // A tiny fake executor standing in for what useCurrentIdentity does
    // with useQuery: build the query key for the CURRENT generation, run
    // the captured fetch (via the injected fake fetcher, no Supabase
    // involved), and only then hand the tagged result to the pure
    // resolver. This exercises the real buildWorkerIdentityQueryOptions +
    // fetchWorkerIdentitySnapshot + resolveIdentityState pipeline end to
    // end -- still no React Query involved.
    const fakeFetchWorkerRow = async (id: number) => ({
      name: `Worker ${id}`,
      profile_picture: null,
    });

    async function runForGeneration(authUserId: string, workerId: number) {
      const { queryKey } = buildWorkerIdentityQueryOptions(authUserId, workerId);
      const result = await fetchWorkerIdentitySnapshot(authUserId, workerId, fakeFetchWorkerRow);
      const snapshot: WorkerQuerySnapshot = {
        forAuthUserId: result.forAuthUserId,
        forWorkerId: result.forWorkerId,
        status: "success",
        data: result.data,
      };
      return { queryKey, resolution: resolveIdentityState(
        { authUserId, status: "success", role: "worker", workerId },
        snapshot
      ) };
    }

    // Before the new user's own profile/worker query has resolved, the
    // resolver must see `loading` -- modeled here by resolving against the
    // OLD generation's snapshot while the profile snapshot has already
    // moved to the new user (the exact case already covered by the pure
    // resolver test above); this test additionally proves the query-key
    // layer itself would never let the old generation's fetch satisfy the
    // new one to begin with.
    const staleProfile: ProfileSnapshot = {
      authUserId: "user-b",
      status: "loading",
      role: null,
      workerId: null,
    };
    expect(resolveIdentityState(staleProfile, null)).toEqual({ status: "loading" });

    // Once the new user's own generation actually runs and resolves, it
    // reaches `ready` using its own freshly-captured data -- never user A's
    // -- and its query key is distinct from any prior user's key.
    const forUserA = await runForGeneration("user-a", 7);
    const forUserB = await runForGeneration("user-b", 9);

    expect(forUserA.queryKey).not.toEqual(forUserB.queryKey);
    expect(forUserB.resolution).toEqual({
      status: "ready",
      role: "worker",
      source: "worker-row",
      worker: { name: "Worker 9", profile_picture: null },
    });
  });
});

describe("enrichResolution (display name resolution)", () => {
  test("ready-admin resolves the exact role label and an email-local-part fallback name", () => {
    const state = enrichResolution(
      { status: "ready", role: "admin", source: "fallback" },
      { email: "ana.perez@example.com" }
    );
    expect(state).toMatchObject({
      status: "ready",
      role: "admin",
      roleLabel: "Administrador",
      displayName: "ana perez",
      isNameFallback: true,
      avatarUrl: null,
      initials: "AP",
    });
  });

  test("ready-staff resolves the exact role label", () => {
    const state = enrichResolution(
      { status: "ready", role: "staff", source: "fallback" },
      { email: "juan@example.com" }
    );
    expect(state).toMatchObject({ roleLabel: "Personal administrativo", isNameFallback: true });
  });

  test("a worker row with a usable name is not treated as a fallback", () => {
    const state = enrichResolution(
      {
        status: "ready",
        role: "worker",
        source: "worker-row",
        worker: { name: "Ana Pérez", profile_picture: null },
      },
      { email: "ana@example.com" }
    );
    expect(state).toMatchObject({
      roleLabel: "Docente",
      displayName: "Ana Pérez",
      isNameFallback: false,
      avatarUrl: null,
      initials: "AP",
    });
  });

  test("a worker row with a blank name still falls back to the email local part", () => {
    const state = enrichResolution(
      {
        status: "ready",
        role: "worker",
        source: "worker-row",
        worker: { name: "   ", profile_picture: null },
      },
      { email: "ana.perez@example.com" }
    );
    expect(state).toMatchObject({ displayName: "ana perez", isNameFallback: true });
  });

  test("non-ready resolutions pass through unchanged", () => {
    expect(enrichResolution({ status: "incomplete" }, { email: null })).toEqual({
      status: "incomplete",
    });
    expect(enrichResolution({ status: "worker-error" }, { email: null })).toEqual({
      status: "worker-error",
    });
  });

  describe("'Usuario' fallback when no worker name and no usable email exist", () => {
    test("missing email (null) falls back to 'Usuario' / initial 'U'", () => {
      const state = enrichResolution(
        { status: "ready", role: "admin", source: "fallback" },
        { email: null }
      );
      expect(state).toMatchObject({
        displayName: FALLBACK_DISPLAY_NAME,
        isNameFallback: true,
        initials: "U",
      });
      expect(FALLBACK_DISPLAY_NAME).toBe("Usuario");
    });

    test("empty email ('') falls back to 'Usuario'", () => {
      const state = enrichResolution(
        { status: "ready", role: "staff", source: "fallback" },
        { email: "" }
      );
      expect(state).toMatchObject({ displayName: "Usuario", initials: "U" });
    });

    test("malformed email with an empty local part ('@example.com') falls back to 'Usuario'", () => {
      const state = enrichResolution(
        { status: "ready", role: "worker", source: "fallback" },
        { email: "@example.com" }
      );
      expect(state).toMatchObject({ displayName: "Usuario", initials: "U" });
    });

    test("whitespace-only email falls back to 'Usuario'", () => {
      const state = enrichResolution(
        { status: "ready", role: "admin", source: "fallback" },
        { email: "   " }
      );
      expect(state).toMatchObject({ displayName: "Usuario", initials: "U" });
    });

    test("a worker row with a blank name and no usable email falls back to 'Usuario', not a blank name", () => {
      const state = enrichResolution(
        {
          status: "ready",
          role: "worker",
          source: "worker-row",
          worker: { name: "   ", profile_picture: null },
        },
        { email: null }
      );
      expect(state).toMatchObject({ displayName: "Usuario", initials: "U", isNameFallback: true });
    });

    test("the fallback name is never blank, so the accessible trigger label is never blank or trailing-space-only", () => {
      const state = enrichResolution(
        { status: "ready", role: "admin", source: "fallback" },
        { email: undefined as unknown as string | null }
      );
      if (state.status !== "ready") throw new Error("expected ready state");
      const accessibleLabel = `Abrir opciones de cuenta de ${state.displayName}`;
      expect(accessibleLabel).toBe("Abrir opciones de cuenta de Usuario");
      expect(accessibleLabel.trim()).not.toBe("Abrir opciones de cuenta de");
    });
  });
});
