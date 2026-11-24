import { describe, expect, test } from "bun:test";
import { groupScheduleAssignments } from "./groupScheduleAssignments";
import type { ScheduleAssignment } from "./useScheduleAssignments";

describe("groupScheduleAssignments", () => {
  test("preserves order and groups by either supported key", () => {
    const rows = [
      { subject_id: 1, group_id: 2 },
      { subject_id: 1, group_id: 3 },
      { subject_id: 4, group_id: 2 },
    ] as ScheduleAssignment[];
    expect(groupScheduleAssignments(rows, "subject_id")).toEqual({ "1": [rows[0], rows[1]], "4": [rows[2]] });
    expect(groupScheduleAssignments(rows, "group_id")).toEqual({ "2": [rows[0], rows[2]], "3": [rows[1]] });
    expect(groupScheduleAssignments([], "group_id")).toEqual({});
  });
});
