import { describe, expect, test } from "bun:test";
import {
  buildMyWorkerProfileQueryOptions,
  canFetchMyWorkerProfile,
  fetchMyWorkerProfileSnapshot,
  resolveMyWorkerProfileSnapshot,
  type MyWorkerProfileSnapshot,
  type ProfileQueryIdentity,
} from "./workerProfileQuery";
import type { MyWorkerProfile } from "../../services/apiWorkers";

const sampleProfile: MyWorkerProfile = {
  name: "Ana Pérez",
  email: "ana@example.test",
  phone: "555-0000",
  type_worker: "Docente",
  status: 1,
  specialty: "Matemáticas",
  function_performed: "Titular",
  profile_picture: null,
};

describe("canFetchMyWorkerProfile (gating)", () => {
  test("a valid authUserId + workerId may fetch", () => {
    expect(canFetchMyWorkerProfile({ authUserId: "user-a", workerId: 7 })).toBe(true);
  });

  test("a missing authUserId may not fetch", () => {
    expect(canFetchMyWorkerProfile({ authUserId: null, workerId: 7 })).toBe(false);
  });

  test("an empty-string authUserId may not fetch", () => {
    expect(canFetchMyWorkerProfile({ authUserId: "", workerId: 7 })).toBe(false);
  });

  test.each([
    ["missing workerId", null],
    ["zero workerId", 0],
    ["negative workerId", -3],
    ["non-integer workerId", 2.5],
    ["NaN workerId", NaN],
  ])("%s may not fetch", (_label, workerId) => {
    expect(canFetchMyWorkerProfile({ authUserId: "user-a", workerId })).toBe(false);
  });
});

describe("buildMyWorkerProfileQueryOptions (account-sensitive key)", () => {
  test("two different authenticated users with the same workerId produce distinct keys", () => {
    const forUserA = buildMyWorkerProfileQueryOptions("user-a", 7);
    const forUserB = buildMyWorkerProfileQueryOptions("user-b", 7);

    expect(forUserA.queryKey).toEqual(["my-worker-profile", "user-a", 7]);
    expect(forUserA.queryKey).not.toEqual(forUserB.queryKey);
  });

  test("two different workers under the same auth user produce distinct keys", () => {
    const workerSeven = buildMyWorkerProfileQueryOptions("user-a", 7);
    const workerNine = buildMyWorkerProfileQueryOptions("user-a", 9);

    expect(workerSeven.queryKey).not.toEqual(workerNine.queryKey);
  });

  test("cached data for one account cannot satisfy another account's key", () => {
    const cache = new Map<string, unknown>();
    const forUserA = buildMyWorkerProfileQueryOptions("user-a", 7);
    const forUserB = buildMyWorkerProfileQueryOptions("user-b", 7);

    cache.set(JSON.stringify(forUserA.queryKey), {
      forAuthUserId: "user-a",
      forWorkerId: 7,
      data: sampleProfile,
    });

    expect(cache.has(JSON.stringify(forUserB.queryKey))).toBe(false);
  });
});

describe("fetchMyWorkerProfileSnapshot (capture-at-request-time)", () => {
  test("the snapshot preserves the identity captured when the request started, surviving an await race", async () => {
    const fakeFetchProfile = async () => sampleProfile;

    let ambientAuthUserId = "user-a";
    const promise = fetchMyWorkerProfileSnapshot("user-a", 7, fakeFetchProfile);
    ambientAuthUserId = "user-b";
    const snapshot = await promise;

    expect(snapshot.forAuthUserId).toBe("user-a");
    expect(snapshot.forAuthUserId).not.toBe(ambientAuthUserId);
    expect(snapshot.forWorkerId).toBe(7);
    expect(snapshot.data).toEqual(sampleProfile);
  });

  test("a missing worker row resolves to a snapshot with data: null, not a thrown error", async () => {
    const fakeFetchProfile = async () => null;
    const snapshot = await fetchMyWorkerProfileSnapshot("user-a", 7, fakeFetchProfile);
    expect(snapshot).toEqual({ forAuthUserId: "user-a", forWorkerId: 7, data: null });
  });
});

describe("resolveMyWorkerProfileSnapshot (stale-generation rejection)", () => {
  const currentIdentity: ProfileQueryIdentity = { authUserId: "user-b", workerId: 9 };

  test("a snapshot matching the current generation resolves", () => {
    const snapshot: MyWorkerProfileSnapshot = {
      forAuthUserId: "user-b",
      forWorkerId: 9,
      data: sampleProfile,
    };
    expect(resolveMyWorkerProfileSnapshot(snapshot, currentIdentity)).toEqual({
      status: "resolved",
      profile: sampleProfile,
    });
  });

  test("a resolved-but-missing-row snapshot (data: null) is distinguishable from pending", () => {
    const snapshot: MyWorkerProfileSnapshot = {
      forAuthUserId: "user-b",
      forWorkerId: 9,
      data: null,
    };
    expect(resolveMyWorkerProfileSnapshot(snapshot, currentIdentity)).toEqual({
      status: "resolved",
      profile: null,
    });
  });

  test("a stale snapshot from a different authUserId is rejected as pending", () => {
    const staleSnapshot: MyWorkerProfileSnapshot = {
      forAuthUserId: "user-a",
      forWorkerId: 9,
      data: sampleProfile,
    };
    expect(resolveMyWorkerProfileSnapshot(staleSnapshot, currentIdentity)).toEqual({
      status: "pending",
    });
  });

  test("a stale snapshot from a different workerId is rejected as pending", () => {
    const staleSnapshot: MyWorkerProfileSnapshot = {
      forAuthUserId: "user-b",
      forWorkerId: 5,
      data: sampleProfile,
    };
    expect(resolveMyWorkerProfileSnapshot(staleSnapshot, currentIdentity)).toEqual({
      status: "pending",
    });
  });

  test("no current identity (ungated) is always pending regardless of snapshot", () => {
    const snapshot: MyWorkerProfileSnapshot = {
      forAuthUserId: "user-b",
      forWorkerId: 9,
      data: sampleProfile,
    };
    expect(resolveMyWorkerProfileSnapshot(snapshot, null)).toEqual({ status: "pending" });
  });

  test("no snapshot yet is pending", () => {
    expect(resolveMyWorkerProfileSnapshot(undefined, currentIdentity)).toEqual({
      status: "pending",
    });
  });
});

describe("exact eight-field projection is unchanged by this query layer", () => {
  test("MyWorkerProfile carries exactly the eight allow-listed fields", () => {
    expect(Object.keys(sampleProfile).sort()).toEqual(
      [
        "email",
        "function_performed",
        "name",
        "phone",
        "profile_picture",
        "specialty",
        "status",
        "type_worker",
      ].sort()
    );
  });
});
