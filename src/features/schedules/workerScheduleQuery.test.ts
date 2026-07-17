import { describe, expect, test } from "bun:test";
import {
  buildMyScheduleAssignmentsQueryOptions,
  buildMyScheduleTeacherActivitiesQueryOptions,
  canRunMyScheduleQuery,
  fetchMyScheduleAssignmentsSnapshot,
  fetchMyScheduleTeacherActivitiesSnapshot,
  isValidSemesterId,
  resolveMyScheduleAssignmentsSnapshot,
  resolveMyScheduleTeacherActivitiesSnapshot,
  type MyScheduleAssignmentsSnapshot,
  type ScheduleQueryIdentity,
} from "./workerScheduleQuery";

describe("isValidSemesterId", () => {
  test("a positive integer is valid", () => {
    expect(isValidSemesterId(3)).toBe(true);
  });

  test.each([
    ["zero", 0],
    ["negative", -1],
    ["non-integer", 1.5],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["null", null],
    ["undefined", undefined],
    ["a string", "3"],
  ])("%s is invalid", (_label, value) => {
    expect(isValidSemesterId(value)).toBe(false);
  });
});

describe("canRunMyScheduleQuery (gating)", () => {
  const valid = { authUserId: "user-a", workerId: 7, semesterId: 3 };

  test("a fully valid identity may run", () => {
    expect(canRunMyScheduleQuery(valid)).toBe(true);
  });

  test("a missing authUserId may not run", () => {
    expect(canRunMyScheduleQuery({ ...valid, authUserId: null })).toBe(false);
  });

  test("an empty-string authUserId may not run", () => {
    expect(canRunMyScheduleQuery({ ...valid, authUserId: "" })).toBe(false);
  });

  test("a whitespace-only authUserId may not run", () => {
    expect(canRunMyScheduleQuery({ ...valid, authUserId: "   " })).toBe(false);
  });

  test.each([
    ["missing workerId", null],
    ["zero workerId", 0],
    ["negative workerId", -3],
  ])("%s may not run", (_label, workerId) => {
    expect(canRunMyScheduleQuery({ ...valid, workerId })).toBe(false);
  });

  test.each([
    ["missing semesterId", null],
    ["zero semesterId", 0],
    ["undefined semesterId", undefined],
  ])("%s may not run", (_label, semesterId) => {
    expect(canRunMyScheduleQuery({ ...valid, semesterId })).toBe(false);
  });
});

describe("buildMyScheduleAssignmentsQueryOptions / buildMyScheduleTeacherActivitiesQueryOptions (query-key isolation)", () => {
  test("worker A and worker B under the same semester produce distinct assignment keys", () => {
    const a = buildMyScheduleAssignmentsQueryOptions("user-a", 5, 3);
    const b = buildMyScheduleAssignmentsQueryOptions("user-a", 9, 3);

    expect(a.queryKey).toEqual(["my-schedule", "assignments", "user-a", 5, 3]);
    expect(a.queryKey).not.toEqual(b.queryKey);
  });

  test("the same workerId under two different authenticated users produces distinct keys", () => {
    const forUserA = buildMyScheduleAssignmentsQueryOptions("user-a", 5, 3);
    const forUserB = buildMyScheduleAssignmentsQueryOptions("user-b", 5, 3);

    expect(forUserA.queryKey).not.toEqual(forUserB.queryKey);
  });

  test("assignments and activities never share a key for identical identity/semester", () => {
    const assignments = buildMyScheduleAssignmentsQueryOptions("user-a", 5, 3);
    const activities = buildMyScheduleTeacherActivitiesQueryOptions("user-a", 5, 3);

    expect(assignments.queryKey).not.toEqual(activities.queryKey);
    expect(assignments.queryKey[1]).toBe("assignments");
    expect(activities.queryKey[1]).toBe("activities");
  });

  test("a different semester for the same worker produces a distinct key", () => {
    const semesterOne = buildMyScheduleAssignmentsQueryOptions("user-a", 5, 3);
    const semesterTwo = buildMyScheduleAssignmentsQueryOptions("user-a", 5, 4);

    expect(semesterOne.queryKey).not.toEqual(semesterTwo.queryKey);
  });

  test("cached data for user A cannot satisfy user B's query key", () => {
    const cache = new Map<string, unknown>();
    const optionsA = buildMyScheduleAssignmentsQueryOptions("user-a", 5, 3);
    const optionsB = buildMyScheduleAssignmentsQueryOptions("user-b", 5, 3);

    cache.set(JSON.stringify(optionsA.queryKey), {
      forAuthUserId: "user-a",
      forWorkerId: 5,
      forSemesterId: 3,
      data: [],
    });

    expect(cache.has(JSON.stringify(optionsB.queryKey))).toBe(false);
  });
});

describe("fetchMyScheduleAssignmentsSnapshot / fetchMyScheduleTeacherActivitiesSnapshot (capture-at-request-time)", () => {
  test("the snapshot preserves the identity captured when the request started, surviving an await race", async () => {
    const fakeFetchRows = async (semesterId: number) => [
      { id: 1, weekday: "Lunes", start_time: "07:00:00", end_time: "08:50:00", subjects: null, groups: null, __semesterId: semesterId } as never,
    ];

    let ambientAuthUserId = "user-a";
    const promise = fetchMyScheduleAssignmentsSnapshot("user-a", 5, 3, fakeFetchRows);
    ambientAuthUserId = "user-b"; // the "current user" moves on mid-flight
    const snapshot = await promise;

    expect(snapshot.forAuthUserId).toBe("user-a");
    expect(snapshot.forAuthUserId).not.toBe(ambientAuthUserId);
    expect(snapshot.forWorkerId).toBe(5);
    expect(snapshot.forSemesterId).toBe(3);
  });

  test("activities snapshot equivalently captures its identity across an await", async () => {
    const fakeFetchRows = async () => [
      { id: 1, weekday: "Lunes", start_time: "07:00:00", end_time: "08:50:00", activity: "Guardia" },
    ];

    const promise = fetchMyScheduleTeacherActivitiesSnapshot("user-a", 5, 3, fakeFetchRows);
    const snapshot = await promise;

    expect(snapshot).toEqual({
      forAuthUserId: "user-a",
      forWorkerId: 5,
      forSemesterId: 3,
      data: [{ id: 1, weekday: "Lunes", start_time: "07:00:00", end_time: "08:50:00", activity: "Guardia" }],
    });
  });
});

describe("resolveMyScheduleAssignmentsSnapshot / resolveMyScheduleTeacherActivitiesSnapshot (stale-generation rejection)", () => {
  const currentIdentity: ScheduleQueryIdentity = { authUserId: "user-b", workerId: 9, semesterId: 3 };

  test("a snapshot matching the current generation resolves to its data", () => {
    const snapshot: MyScheduleAssignmentsSnapshot = {
      forAuthUserId: "user-b",
      forWorkerId: 9,
      forSemesterId: 3,
      data: [],
    };
    expect(resolveMyScheduleAssignmentsSnapshot(snapshot, currentIdentity)).toBe(snapshot.data);
  });

  test("a stale snapshot from a different authUserId is rejected (undefined, not surfaced)", () => {
    const staleSnapshot: MyScheduleAssignmentsSnapshot = {
      forAuthUserId: "user-a", // previous account
      forWorkerId: 9,
      forSemesterId: 3,
      data: [{ id: 1 } as never],
    };
    expect(resolveMyScheduleAssignmentsSnapshot(staleSnapshot, currentIdentity)).toBeUndefined();
  });

  test("a stale snapshot from a different workerId is rejected", () => {
    const staleSnapshot: MyScheduleAssignmentsSnapshot = {
      forAuthUserId: "user-b",
      forWorkerId: 5, // stale worker id
      forSemesterId: 3,
      data: [{ id: 1 } as never],
    };
    expect(resolveMyScheduleAssignmentsSnapshot(staleSnapshot, currentIdentity)).toBeUndefined();
  });

  test("a stale snapshot from a different semesterId is rejected", () => {
    const staleSnapshot: MyScheduleAssignmentsSnapshot = {
      forAuthUserId: "user-b",
      forWorkerId: 9,
      forSemesterId: 2, // stale semester
      data: [{ id: 1 } as never],
    };
    expect(resolveMyScheduleAssignmentsSnapshot(staleSnapshot, currentIdentity)).toBeUndefined();
  });

  test("no current identity (ungated) always resolves to undefined regardless of snapshot", () => {
    const snapshot: MyScheduleAssignmentsSnapshot = {
      forAuthUserId: "user-b",
      forWorkerId: 9,
      forSemesterId: 3,
      data: [],
    };
    expect(resolveMyScheduleAssignmentsSnapshot(snapshot, null)).toBeUndefined();
  });

  test("no snapshot yet resolves to undefined", () => {
    expect(resolveMyScheduleAssignmentsSnapshot(undefined, currentIdentity)).toBeUndefined();
  });

  test("activities resolver applies the identical generation guard", () => {
    const staleSnapshot = {
      forAuthUserId: "user-a",
      forWorkerId: 9,
      forSemesterId: 3,
      data: [{ id: 1 } as never],
    };
    expect(resolveMyScheduleTeacherActivitiesSnapshot(staleSnapshot, currentIdentity)).toBeUndefined();

    const freshSnapshot = { ...staleSnapshot, forAuthUserId: "user-b" };
    expect(resolveMyScheduleTeacherActivitiesSnapshot(freshSnapshot, currentIdentity)).toBe(
      freshSnapshot.data
    );
  });
});

describe("account-switch race, end to end through the real pipeline (no QueryClient, real functions)", () => {
  test("an in-flight request for account A never populates account B's active result", async () => {
    const fakeFetchRows = async (semesterId: number) => [
      { id: semesterId, weekday: "Lunes", start_time: "07:00:00", end_time: "08:50:00", subjects: null, groups: null },
    ];

    async function runForGeneration(authUserId: string, workerId: number, semesterId: number) {
      const { queryKey } = buildMyScheduleAssignmentsQueryOptions(authUserId, workerId, semesterId);
      const snapshot = await fetchMyScheduleAssignmentsSnapshot(
        authUserId,
        workerId,
        semesterId,
        fakeFetchRows
      );
      return { queryKey, snapshot };
    }

    const forUserA = await runForGeneration("user-a", 5, 3);
    const forUserB = await runForGeneration("user-b", 9, 3);

    // Account A's in-flight snapshot resolved against account B's CURRENT
    // identity must never be trusted.
    const resolvedForB = resolveMyScheduleAssignmentsSnapshot(forUserA.snapshot, {
      authUserId: "user-b",
      workerId: 9,
      semesterId: 3,
    });
    expect(resolvedForB).toBeUndefined();

    // Account B's own snapshot, resolved against account B's identity, is trusted.
    const resolvedForBOwnSnapshot = resolveMyScheduleAssignmentsSnapshot(forUserB.snapshot, {
      authUserId: "user-b",
      workerId: 9,
      semesterId: 3,
    });
    expect(resolvedForBOwnSnapshot).toBe(forUserB.snapshot.data);

    expect(forUserA.queryKey).not.toEqual(forUserB.queryKey);
  });
});
