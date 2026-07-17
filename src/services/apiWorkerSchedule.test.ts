import { describe, expect, mock, test } from "bun:test";

let nextResponse: { data: unknown; error: unknown } = { data: [], error: null };
let lastSelectArg: string | null = null;
let lastEqArgs: [string, unknown] | null = null;

// Captures the exact .select()/.eq() arguments these two worker-schedule
// reads issue, so the projection itself (not just its runtime behavior)
// is directly assertable -- audit finding: query security/projection
// tests were previously missing for this security-sensitive layer. Mirrors
// the existing mock.module pattern already established in
// apiWorkers.test.ts for getWorkerIdentityById.
mock.module("./supabase", () => ({
  default: {
    from: () => ({
      select: (arg: string) => {
        lastSelectArg = arg;
        return {
          eq: (column: string, value: unknown) => {
            lastEqArgs = [column, value];
            return nextResponse;
          },
        };
      },
    }),
  },
}));

const { getMyScheduleAssignments, getMyScheduleTeacherActivities } = await import(
  "./apiWorkerSchedule"
);

describe("getMyScheduleAssignments (exact projection)", () => {
  test("selects exactly the narrow assignment projection, no workers embed", async () => {
    nextResponse = { data: [], error: null };
    await getMyScheduleAssignments(3);

    expect(lastSelectArg).toBe(
      "id, weekday, start_time, end_time, subjects(name), groups(letter, year_of_admission, degrees(code, name))"
    );
    expect(lastSelectArg).not.toContain("workers(");
    expect(lastSelectArg).not.toContain("workers(*)");
  });

  test("filters by the exact semester_id column and value, never a worker_id filter", async () => {
    nextResponse = { data: [], error: null };
    await getMyScheduleAssignments(9);

    expect(lastEqArgs).toEqual(["semester_id", 9]);
  });

  test("a query failure throws the exact Spanish message, not the raw Supabase error", async () => {
    nextResponse = { data: null, error: { message: "connection refused" } };
    await expect(getMyScheduleAssignments(3)).rejects.toThrow("Tu horario no pudo cargarse");
  });

  test("a successful empty result resolves to an empty array, not null/undefined", async () => {
    nextResponse = { data: null, error: null };
    const result = await getMyScheduleAssignments(3);
    expect(result).toEqual([]);
  });
});

describe("getMyScheduleTeacherActivities (exact projection)", () => {
  test("selects exactly the narrow activity projection, no workers embed", async () => {
    nextResponse = { data: [], error: null };
    await getMyScheduleTeacherActivities(3);

    expect(lastSelectArg).toBe("id, weekday, start_time, end_time, activity");
    expect(lastSelectArg).not.toContain("workers(");
    expect(lastSelectArg).not.toContain("workers(*)");
  });

  test("filters by the exact semester_id column and value, never a worker_id filter", async () => {
    nextResponse = { data: [], error: null };
    await getMyScheduleTeacherActivities(11);

    expect(lastEqArgs).toEqual(["semester_id", 11]);
  });

  test("a query failure throws the exact Spanish message", async () => {
    nextResponse = { data: null, error: { message: "connection refused" } };
    await expect(getMyScheduleTeacherActivities(3)).rejects.toThrow(
      "Tu horario no pudo cargarse"
    );
  });
});

describe("the two projections never collide with each other's shape", () => {
  test("assignments and activities select distinct column lists", async () => {
    nextResponse = { data: [], error: null };
    await getMyScheduleAssignments(1);
    const assignmentsSelect = lastSelectArg;

    await getMyScheduleTeacherActivities(1);
    const activitiesSelect = lastSelectArg;

    expect(assignmentsSelect).not.toBe(activitiesSelect);
    expect(assignmentsSelect).toContain("subjects");
    expect(activitiesSelect).toContain("activity");
  });
});
