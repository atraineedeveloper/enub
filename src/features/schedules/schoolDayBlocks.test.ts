import { describe, expect, test } from "bun:test";
import {
  RECESS_LABEL,
  WORKER_SCHEDULE_DAY_BLOCKS,
  formatSchoolDayBlockLabel,
  mergeRecessIntoDayEntries,
} from "./schoolDayBlocks";
import {
  partitionWorkerSchedule,
  type WorkerScheduleEntry,
} from "./workerScheduleEntry";
import { resolveMyScheduleViewState } from "./myScheduleViewState";
import type { Semester } from "../semesters/useSemesters";

describe("formatSchoolDayBlockLabel", () => {
  test("reproduces every existing TEACHER_SCHEDULE_BLOCKS label exactly", () => {
    expect(formatSchoolDayBlockLabel("07:00:00", "08:50:00")).toBe("7:00 - 8:50");
    expect(formatSchoolDayBlockLabel("09:20:00", "11:10:00")).toBe("9:20 - 11:10");
    expect(formatSchoolDayBlockLabel("11:10:00", "13:00:00")).toBe("11:10 - 13:00");
    expect(formatSchoolDayBlockLabel("13:10:00", "15:00:00")).toBe("13:10 - 15:00");
    expect(formatSchoolDayBlockLabel("17:00:00", "19:00:00")).toBe("17:00 - 19:00");
  });

  test("formats the two recess periods in the same convention", () => {
    expect(formatSchoolDayBlockLabel("08:50:00", "09:20:00")).toBe("8:50 - 9:20");
    expect(formatSchoolDayBlockLabel("13:00:00", "13:10:00")).toBe("13:00 - 13:10");
  });
});

describe("WORKER_SCHEDULE_DAY_BLOCKS (desktop row sequence)", () => {
  test("contains exactly 7 rows: 5 teachable blocks + 2 recess periods", () => {
    expect(WORKER_SCHEDULE_DAY_BLOCKS).toHaveLength(7);
    expect(WORKER_SCHEDULE_DAY_BLOCKS.filter((b) => b.kind === "recess")).toHaveLength(2);
    expect(WORKER_SCHEDULE_DAY_BLOCKS.filter((b) => b.kind === "schedule")).toHaveLength(5);
  });

  test("exact chronological row order", () => {
    expect(
      WORKER_SCHEDULE_DAY_BLOCKS.map((b) => [b.kind, b.startTime, b.endTime])
    ).toEqual([
      ["schedule", "07:00:00", "08:50:00"],
      ["recess", "08:50:00", "09:20:00"],
      ["schedule", "09:20:00", "11:10:00"],
      ["schedule", "11:10:00", "13:00:00"],
      ["recess", "13:00:00", "13:10:00"],
      ["schedule", "13:10:00", "15:00:00"],
      ["schedule", "17:00:00", "19:00:00"],
    ]);
  });

  test("exact recess periods", () => {
    const recesses = WORKER_SCHEDULE_DAY_BLOCKS.filter((b) => b.kind === "recess");
    expect(recesses).toEqual([
      { kind: "recess", startTime: "08:50:00", endTime: "09:20:00", label: "RECESO" },
      { kind: "recess", startTime: "13:00:00", endTime: "13:10:00", label: "RECESO" },
    ]);
  });

  test("exact label is RECESO on both recess blocks", () => {
    const recesses = WORKER_SCHEDULE_DAY_BLOCKS.filter((b) => b.kind === "recess");
    for (const recess of recesses) {
      expect(recess.kind === "recess" && recess.label).toBe("RECESO");
    }
    expect(RECESS_LABEL).toBe("RECESO");
  });

  test("recess blocks are structurally distinct from WorkerScheduleEntry -- no id/subject/activity/weekday fields", () => {
    const recesses = WORKER_SCHEDULE_DAY_BLOCKS.filter((b) => b.kind === "recess");
    for (const recess of recesses) {
      expect(recess).not.toHaveProperty("id");
      expect(recess).not.toHaveProperty("subject");
      expect(recess).not.toHaveProperty("activity");
      expect(recess).not.toHaveProperty("weekday");
      expect(recess.kind).not.toBe("class");
      expect(recess.kind).not.toBe("activity");
    }
  });
});

describe("recess periods are excluded from schedule partitioning", () => {
  test("partitionWorkerSchedule's input/output types admit only WorkerScheduleEntry -- recess-shaped objects are never valid members", () => {
    // A real WorkerScheduleEntry array, with no recess mixed in --
    // recess-shaped objects (kind: "recess") are not assignable to
    // WorkerScheduleEntry (kind: "class" | "activity") at the type level,
    // so there is no runtime code path that could smuggle one through
    // partitionWorkerSchedule. This test proves the partition function's
    // real behavior is unaffected by the mere existence of recess data
    // elsewhere in this module -- it still partitions exactly the
    // authorized entries it's given, nothing more.
    const entries: WorkerScheduleEntry[] = [
      {
        kind: "class",
        id: "assignment-1",
        weekday: "Lunes",
        startTime: "07:00:00",
        endTime: "08:50:00",
        subject: "Matemáticas",
        group: "1A",
      },
    ];
    const partition = partitionWorkerSchedule(entries);
    expect(partition.desktopPlaceable).toHaveLength(1);
    expect(partition.mobilePlaceable).toHaveLength(1);
    expect(partition.unplaceable).toHaveLength(0);
    // No recess data appears anywhere in the partition output.
    for (const region of [partition.desktopPlaceable, partition.mobilePlaceable, partition.unplaceable]) {
      for (const entry of region) {
        expect(entry.kind === "class" || entry.kind === "activity").toBe(true);
      }
    }
  });
});

describe("recess periods do not affect empty-state detection", () => {
  const semester: Semester = { id: 1, semester: "1A", school_year: "2025-2026" } as Semester;

  test("zero authorized rows still resolves to empty-schedule, independent of the 7-row desktop sequence existing", () => {
    // WORKER_SCHEDULE_DAY_BLOCKS always has 7 rows (5 schedule + 2
    // recess) regardless of whether the worker has any real data --
    // resolveMyScheduleViewState never imports schoolDayBlocks.ts at all,
    // so this proves empty-schedule detection depends only on the
    // authorized schedule_assignments/schedule_teachers rows, never on
    // the fixed recess/row-sequence presentation data.
    expect(WORKER_SCHEDULE_DAY_BLOCKS).toHaveLength(7);

    const state = resolveMyScheduleViewState({
      isLoadingSemesters: false,
      semestersError: null,
      semesters: [semester],
      selectedSemesterId: 1,
      isLoadingAssignments: false,
      assignmentsError: null,
      scheduleAssignments: [],
      isLoadingActivities: false,
      activitiesError: null,
      scheduleTeacherActivities: [],
    });

    expect(state).toEqual({ status: "empty-schedule" });
  });

  test("non-empty authorized rows resolve to ready with only real entries, never recess-inflated", () => {
    const state = resolveMyScheduleViewState({
      isLoadingSemesters: false,
      semestersError: null,
      semesters: [semester],
      selectedSemesterId: 1,
      isLoadingAssignments: false,
      assignmentsError: null,
      scheduleAssignments: [
        {
          id: 1,
          weekday: "Lunes",
          start_time: "07:00:00",
          end_time: "08:50:00",
          subjects: { name: "Matemáticas" },
          groups: null,
        },
      ],
      isLoadingActivities: false,
      activitiesError: null,
      scheduleTeacherActivities: [],
    });

    expect(state.status).toBe("ready");
    if (state.status === "ready") {
      expect(state.entries).toHaveLength(1);
      expect(state.entries.every((entry) => entry.kind === "class" || entry.kind === "activity")).toBe(
        true
      );
    }
  });
});

describe("mergeRecessIntoDayEntries (mobile agenda ordering)", () => {
  const classEntry = (overrides: Partial<WorkerScheduleEntry> = {}): WorkerScheduleEntry =>
    ({
      kind: "class",
      id: "assignment-1",
      weekday: "Lunes",
      startTime: "07:00:00",
      endTime: "08:50:00",
      subject: "Matemáticas",
      group: "1A",
      ...overrides,
    }) as WorkerScheduleEntry;

  test("places recess chronologically between surrounding entries", () => {
    const before = classEntry({ id: "assignment-before", startTime: "07:00:00", endTime: "08:50:00" });
    const between = classEntry({ id: "assignment-between", startTime: "11:10:00", endTime: "13:00:00" });
    const after = classEntry({ id: "assignment-after", startTime: "13:10:00", endTime: "15:00:00" });

    const merged = mergeRecessIntoDayEntries([after, before, between]);
    const order = merged.map((item) => (item.kind === "recess" ? "RECESO" : item.entry.id));

    expect(order).toEqual([
      "assignment-before",
      "RECESO", // 08:50-09:20
      "assignment-between",
      "RECESO", // 13:00-13:10
      "assignment-after",
    ]);
  });

  test("recess appears exactly twice regardless of entry count", () => {
    const merged = mergeRecessIntoDayEntries([classEntry()]);
    expect(merged.filter((item) => item.kind === "recess")).toHaveLength(2);
  });

  test("recess appears exactly twice with zero entries too (caller decides whether to invoke this at all)", () => {
    const merged = mergeRecessIntoDayEntries([]);
    expect(merged.filter((item) => item.kind === "recess")).toHaveLength(2);
    expect(merged.filter((item) => item.kind === "entry")).toHaveLength(0);
  });

  test("no duplicate recess separators -- exactly one item per fixed period", () => {
    const merged = mergeRecessIntoDayEntries([classEntry(), classEntry({ id: "assignment-2" })]);
    const recessStartTimes = merged
      .filter((item) => item.kind === "recess")
      .map((item) => item.startTime);
    expect(recessStartTimes).toEqual(["08:50:00", "13:00:00"]);
    expect(new Set(recessStartTimes).size).toBe(2);
  });

  test("existing deterministic class/activity ordering is unchanged among entries themselves", () => {
    const a = classEntry({ id: "assignment-a", startTime: "09:20:00", endTime: "11:10:00" });
    const b = classEntry({ id: "assignment-b", startTime: "07:00:00", endTime: "08:50:00" });
    const merged = mergeRecessIntoDayEntries([a, b]);
    const entryOrder = merged
      .filter((item) => item.kind === "entry")
      .map((item) => (item.kind === "entry" ? item.entry.id : null));
    expect(entryOrder).toEqual(["assignment-b", "assignment-a"]);
  });
});
