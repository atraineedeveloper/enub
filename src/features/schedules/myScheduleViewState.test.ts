import { describe, expect, test } from "bun:test";
import { resolveMyScheduleViewState, type MyScheduleViewInput } from "./myScheduleViewState";
import type { RawWorkerScheduleAssignmentRow } from "./workerScheduleEntry";
import type { Semester } from "../semesters/useSemesters";

const semester = (overrides: Partial<Semester> = {}): Semester => ({
  id: 1,
  semester: "1A",
  school_year: "2025-2026",
  ...overrides,
} as Semester);

const assignmentRow: RawWorkerScheduleAssignmentRow = {
  id: 1,
  weekday: "Lunes",
  start_time: "07:00:00",
  end_time: "08:50:00",
  subjects: { name: "Matemáticas" },
  groups: null,
};

const baseInput: MyScheduleViewInput = {
  isLoadingSemesters: false,
  semestersError: null,
  semesters: [semester()],
  selectedSemesterId: 1,
  isLoadingAssignments: false,
  assignmentsError: null,
  scheduleAssignments: [assignmentRow],
  isLoadingActivities: false,
  activitiesError: null,
  scheduleTeacherActivities: [],
};

describe("resolveMyScheduleViewState -- partial and dual query failure (audit item 10)", () => {
  test("assignments succeeds, activities fails -> a single error state, not partial content", () => {
    const result = resolveMyScheduleViewState({
      ...baseInput,
      activitiesError: new Error("boom"),
    });
    expect(result).toEqual({ status: "error" });
  });

  test("activities succeeds, assignments fails -> a single error state, not partial content", () => {
    const result = resolveMyScheduleViewState({
      ...baseInput,
      assignmentsError: new Error("boom"),
    });
    expect(result).toEqual({ status: "error" });
  });

  test("both schedule queries fail -> a single error state", () => {
    const result = resolveMyScheduleViewState({
      ...baseInput,
      assignmentsError: new Error("boom"),
      activitiesError: new Error("boom"),
    });
    expect(result).toEqual({ status: "error" });
  });

  test("the semesters query itself failing also yields the single error state", () => {
    const result = resolveMyScheduleViewState({
      ...baseInput,
      semestersError: new Error("boom"),
    });
    expect(result).toEqual({ status: "error" });
  });

  test("both schedule queries succeed with zero rows -> empty-schedule, never error", () => {
    const result = resolveMyScheduleViewState({
      ...baseInput,
      scheduleAssignments: [],
      scheduleTeacherActivities: [],
    });
    expect(result).toEqual({ status: "empty-schedule" });
  });

  test("an error takes priority even while one query is still loading", () => {
    const result = resolveMyScheduleViewState({
      ...baseInput,
      assignmentsError: new Error("boom"),
      isLoadingActivities: true,
      scheduleTeacherActivities: undefined,
    });
    expect(result).toEqual({ status: "error" });
  });
});

describe("resolveMyScheduleViewState -- the rest of the state matrix (regression coverage)", () => {
  test("loading while semesters resolve", () => {
    expect(
      resolveMyScheduleViewState({ ...baseInput, isLoadingSemesters: true, semesters: undefined })
    ).toEqual({ status: "loading" });
  });

  test("no semesters registered at all", () => {
    expect(resolveMyScheduleViewState({ ...baseInput, semesters: [] })).toEqual({
      status: "no-semesters",
    });
  });

  test("loading while a semester is selected but its schedule queries haven't resolved", () => {
    expect(
      resolveMyScheduleViewState({
        ...baseInput,
        isLoadingAssignments: true,
        scheduleAssignments: undefined,
      })
    ).toEqual({ status: "loading" });
  });

  test("loading while no semester is selected yet (mid-reconciliation)", () => {
    expect(
      resolveMyScheduleViewState({ ...baseInput, selectedSemesterId: null })
    ).toEqual({ status: "loading" });
  });

  test("ready with normalized entries when both queries succeed with data", () => {
    const result = resolveMyScheduleViewState(baseInput);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].kind).toBe("class");
    }
  });
});
