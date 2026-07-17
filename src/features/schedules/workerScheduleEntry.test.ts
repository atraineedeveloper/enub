import { describe, expect, test } from "bun:test";
import {
  compareIncompleteScheduleEntries,
  compareWorkerScheduleEntries,
  entriesOutsideDesktopGrid,
  formatScheduleTime,
  formatScheduleWeekday,
  groupWorkerScheduleByWeekday,
  normalizeWorkerSchedule,
  partitionWorkerSchedule,
  selectCellEntries,
  sortIncompleteScheduleEntries,
  sortWorkerScheduleEntries,
  type CanonicalBlockLookup,
  type RawWorkerScheduleAssignmentRow,
  type RawWorkerScheduleTeacherRow,
  type WorkerScheduleEntry,
} from "./workerScheduleEntry";

const assignmentRow = (
  overrides: Partial<RawWorkerScheduleAssignmentRow> = {}
): RawWorkerScheduleAssignmentRow => ({
  id: 1,
  weekday: "Lunes",
  start_time: "07:00:00",
  end_time: "08:50:00",
  subjects: { name: "Matemáticas" },
  groups: { letter: "A", year_of_admission: 2023, degrees: { code: "LIC", name: "Licenciatura" } },
  ...overrides,
});

const activityRow = (
  overrides: Partial<RawWorkerScheduleTeacherRow> = {}
): RawWorkerScheduleTeacherRow => ({
  id: 1,
  weekday: "Martes",
  start_time: "09:20:00",
  end_time: "11:10:00",
  activity: "Junta de academia",
  ...overrides,
});

describe("normalizeWorkerSchedule (every authorized row is represented)", () => {
  test("kind is preserved for both source tables", () => {
    const result = normalizeWorkerSchedule([assignmentRow()], [activityRow()]);
    expect(result.find((e) => e.id === "assignment-1")?.kind).toBe("class");
    expect(result.find((e) => e.id === "activity-1")?.kind).toBe("activity");
  });

  test("ids are prefixed so assignment and activity rows with the same numeric id never collide", () => {
    const result = normalizeWorkerSchedule(
      [assignmentRow({ id: 7 })],
      [activityRow({ id: 7 })]
    );
    const ids = result.map((e) => e.id);
    expect(ids).toContain("assignment-7");
    expect(ids).toContain("activity-7");
    expect(new Set(ids).size).toBe(2);
  });

  test("a null start time still produces a normalized entry, never thrown", () => {
    const result = normalizeWorkerSchedule([assignmentRow({ start_time: null })], []);
    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBeNull();
  });

  test("a null end time still produces a normalized entry", () => {
    const result = normalizeWorkerSchedule([assignmentRow({ end_time: null })], []);
    expect(result).toHaveLength(1);
    expect(result[0].endTime).toBeNull();
  });

  test("a malformed start time normalizes to null, never thrown", () => {
    const result = normalizeWorkerSchedule([assignmentRow({ start_time: "not-a-time" })], []);
    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBeNull();
  });

  test("a malformed end time normalizes to null", () => {
    const result = normalizeWorkerSchedule([assignmentRow({ end_time: "25:99:99garbage" })], []);
    expect(result).toHaveLength(1);
    expect(result[0].endTime).toBeNull();
  });

  test("a syntactically valid but noncanonical time is preserved as-is, not nulled", () => {
    const result = normalizeWorkerSchedule(
      [assignmentRow({ start_time: "10:00:00", end_time: "10:30:00" })],
      []
    );
    expect(result[0].startTime).toBe("10:00:00");
    expect(result[0].endTime).toBe("10:30:00");
  });

  describe("strict time range validation (real ranges, not just shape)", () => {
    test("an impossible value like 99:99:99 is rejected, not accepted as a shape match", () => {
      const result = normalizeWorkerSchedule([assignmentRow({ start_time: "99:99:99" })], []);
      expect(result[0].startTime).toBeNull();
    });

    describe("accepted HH:mm:ss values (seconds-bearing)", () => {
      test.each([
        ["00:00:00 (lower boundary, midnight)", "00:00:00"],
        ["23:59:59 (upper boundary)", "23:59:59"],
        ["12:30:45 (an ordinary mid-range value)", "12:30:45"],
      ])("%s is accepted and preserved as-is", (_label, value) => {
        const result = normalizeWorkerSchedule([assignmentRow({ start_time: value })], []);
        expect(result[0].startTime).toBe(value);
      });
    });

    describe("accepted HH:mm values (no seconds, normalized to HH:mm:00)", () => {
      test.each([
        ["00:00 (lower boundary, midnight)", "00:00", "00:00:00"],
        ["23:59 (upper boundary)", "23:59", "23:59:00"],
        ["07:00 (an ordinary value)", "07:00", "07:00:00"],
      ])("%s is accepted and normalized to %s", (_label, value, normalized) => {
        const result = normalizeWorkerSchedule([assignmentRow({ start_time: value })], []);
        expect(result[0].startTime).toBe(normalized);
      });

      test("an HH:mm value (no seconds) is accepted and normalized to HH:mm:00 -- explicit exact-value assertion", () => {
        const result = normalizeWorkerSchedule(
          [assignmentRow({ start_time: "07:00", end_time: "08:50" })],
          []
        );
        expect(result[0].startTime).toBe("07:00:00");
        expect(result[0].endTime).toBe("08:50:00");
      });
    });

    describe("rejected out-of-range or malformed values (both HH:mm and HH:mm:ss shapes)", () => {
      test.each([
        ["24:00:00 (hour out of range, seconds-bearing)", "24:00:00"],
        ["24:00 (hour out of range, HH:mm)", "24:00"],
        ["23:60:00 (minute out of range, seconds-bearing)", "23:60:00"],
        ["23:60 (minute out of range, HH:mm)", "23:60"],
        ["23:59:60 (second out of range)", "23:59:60"],
        ["-1:00:00 (negative)", "-1:00:00"],
        ["1:00:00 (unpadded hour, seconds-bearing)", "1:00:00"],
        ["1:00 (unpadded hour, HH:mm)", "1:00"],
        ["23:5:00 (unpadded minute, seconds-bearing)", "23:5:00"],
        ["23:5 (unpadded minute, HH:mm)", "23:5"],
        ["ab:cd:ef (alphabetic, seconds-bearing)", "ab:cd:ef"],
        ["ab:cd (alphabetic, HH:mm)", "ab:cd"],
        ["23 (partial, hour only)", "23"],
        ["07:00:00Z (trailing timezone marker)", "07:00:00Z"],
        ["07:00:00.5 (fractional seconds)", "07:00:00.5"],
        ["" as const, ""],
      ])("%s is rejected -> null", (_label, value) => {
        const result = normalizeWorkerSchedule([assignmentRow({ start_time: value })], []);
        expect(result[0].startTime).toBeNull();
      });
    });

    // Direct, literal, non-parameterized restatement of the exact three
    // boundary cases named explicitly by the audit -- kept alongside the
    // broader parameterized tables above rather than instead of them, so
    // these exact mappings are traceable at a glance.
    describe("exact HH:mm boundary mappings named by the audit", () => {
      test("00:00 → 00:00:00 (accepted HH:mm, normalized with seconds appended)", () => {
        const result = normalizeWorkerSchedule([assignmentRow({ start_time: "00:00" })], []);
        expect(result[0].startTime).toBe("00:00:00");
      });

      test("24:00 → null (rejected: hour 24 is out of the 00-23 range)", () => {
        const result = normalizeWorkerSchedule([assignmentRow({ start_time: "24:00" })], []);
        expect(result[0].startTime).toBeNull();
      });

      test("23:60 → null (rejected: minute 60 is out of the 00-59 range)", () => {
        const result = normalizeWorkerSchedule([assignmentRow({ start_time: "23:60" })], []);
        expect(result[0].startTime).toBeNull();
      });
    });

    test("an HH:mm value normalizes to a form that still matches the canonical block table", () => {
      // SCHEDULE_BLOCKS stores "07:00:00"/"08:50:00" -- an HH:mm-shaped row
      // for the same real time must still be recognized as canonical, not
      // silently misclassified as noncanonical purely due to string shape.
      const result = normalizeWorkerSchedule(
        [assignmentRow({ start_time: "07:00", end_time: "08:50" })],
        []
      );
      const partition = partitionWorkerSchedule(result);
      expect(partition.desktopPlaceable).toHaveLength(1);
    });

    test("end time follows the identical boundary rules as start time", () => {
      const validEnd = normalizeWorkerSchedule([assignmentRow({ end_time: "23:59:59" })], []);
      expect(validEnd[0].endTime).toBe("23:59:59");

      const invalidEnd = normalizeWorkerSchedule([assignmentRow({ end_time: "24:00:00" })], []);
      expect(invalidEnd[0].endTime).toBeNull();
    });

    test("activity rows (schedule_teachers) use the identical validation rules", () => {
      const valid = normalizeWorkerSchedule([], [activityRow({ start_time: "00:00:00" })]);
      expect(valid[0].startTime).toBe("00:00:00");

      const invalid = normalizeWorkerSchedule([], [activityRow({ start_time: "99:99:99" })]);
      expect(invalid[0].startTime).toBeNull();
    });
  });

  test("an unrecognized weekday normalizes to Otro, row still present", () => {
    const result = normalizeWorkerSchedule([assignmentRow({ weekday: "Domingo" })], []);
    expect(result).toHaveLength(1);
    expect(result[0].weekday).toBe("Otro");
  });

  test("a null weekday normalizes to Otro", () => {
    const result = normalizeWorkerSchedule([assignmentRow({ weekday: null })], []);
    expect(result[0].weekday).toBe("Otro");
  });

  test("overlapping records (same weekday/time) are never merged", () => {
    const result = normalizeWorkerSchedule(
      [assignmentRow({ id: 1 }), assignmentRow({ id: 2 })],
      []
    );
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["assignment-1", "assignment-2"]);
  });

  test("missing subject falls back to exact text 'Materia no especificada'", () => {
    const result = normalizeWorkerSchedule([assignmentRow({ subjects: null })], []);
    expect(result[0]).toMatchObject({ subject: "Materia no especificada" });
  });

  test("missing group falls back to exact text 'Grupo no especificado'", () => {
    const result = normalizeWorkerSchedule([assignmentRow({ groups: null })], []);
    expect(result[0]).toMatchObject({ group: "Grupo no especificado" });
  });

  test("missing activity text falls back to exact text 'Actividad no especificada'", () => {
    const result = normalizeWorkerSchedule([], [activityRow({ activity: null })]);
    expect(result[0]).toMatchObject({ activity: "Actividad no especificada" });
  });

  test("a per-field fallback never blanks the entry's other valid fields", () => {
    const result = normalizeWorkerSchedule(
      [assignmentRow({ weekday: "Domingo", subjects: { name: "Física" } })],
      []
    );
    expect(result[0]).toMatchObject({ weekday: "Otro", subject: "Física" });
  });

  test("no room field of any kind is ever present on a normalized entry", () => {
    const result = normalizeWorkerSchedule([assignmentRow()], [activityRow()]);
    for (const entry of result) {
      expect(entry).not.toHaveProperty("room");
    }
  });
});

describe("formatScheduleWeekday / formatScheduleTime (exact fallback labels)", () => {
  test("a recognized weekday renders as itself", () => {
    expect(formatScheduleWeekday("Lunes")).toBe("Lunes");
  });

  test("Otro renders as exactly 'Día no especificado'", () => {
    expect(formatScheduleWeekday("Otro")).toBe("Día no especificado");
  });

  test("valid start/end times render as HH:MM–HH:MM", () => {
    expect(formatScheduleTime("07:00:00", "08:50:00")).toBe("07:00–08:50");
  });

  test("a null start time renders as exactly 'Hora no especificada'", () => {
    expect(formatScheduleTime(null, "08:50:00")).toBe("Hora no especificada");
  });

  test("a null end time renders as exactly 'Hora no especificada'", () => {
    expect(formatScheduleTime("07:00:00", null)).toBe("Hora no especificada");
  });
});

const fakeBlocks: CanonicalBlockLookup = {
  isCanonicalClassBlock: (start, end) => start === "07:00:00" && end === "08:50:00",
  isCanonicalActivityBlock: (start, end) => start === "09:20:00" && end === "11:10:00",
};

describe("partitionWorkerSchedule (desktop/mobile/unplaceable, no loss, no duplication)", () => {
  test("a canonical class entry is placeable on both desktop and mobile", () => {
    const entries = normalizeWorkerSchedule([assignmentRow()], []); // 07:00-08:50, canonical
    const { desktopPlaceable, mobilePlaceable } = partitionWorkerSchedule(entries, fakeBlocks);
    expect(desktopPlaceable).toHaveLength(1);
    expect(mobilePlaceable).toHaveLength(1);
  });

  test("a valid but noncanonical time is mobile-placeable but not desktop-placeable", () => {
    const entries = normalizeWorkerSchedule(
      [assignmentRow({ start_time: "10:00:00", end_time: "10:30:00" })],
      []
    );
    const { desktopPlaceable, mobilePlaceable } = partitionWorkerSchedule(entries, fakeBlocks);
    expect(desktopPlaceable).toHaveLength(0);
    expect(mobilePlaceable).toHaveLength(1);
  });

  test("malformed time is unplaceable on both", () => {
    const entries = normalizeWorkerSchedule([assignmentRow({ start_time: null })], []);
    const { desktopPlaceable, mobilePlaceable, unplaceable } = partitionWorkerSchedule(
      entries,
      fakeBlocks
    );
    expect(desktopPlaceable).toHaveLength(0);
    expect(mobilePlaceable).toHaveLength(0);
    expect(unplaceable).toHaveLength(1);
  });

  test("unrecognized weekday is unplaceable on both, even with valid canonical time", () => {
    const entries = normalizeWorkerSchedule([assignmentRow({ weekday: "Domingo" })], []);
    const { desktopPlaceable, mobilePlaceable, unplaceable } = partitionWorkerSchedule(
      entries,
      fakeBlocks
    );
    expect(desktopPlaceable).toHaveLength(0);
    expect(mobilePlaceable).toHaveLength(0);
    expect(unplaceable).toHaveLength(1);
  });

  test("desktopPlaceable is always a subset of mobilePlaceable", () => {
    const entries = normalizeWorkerSchedule(
      [
        assignmentRow({ id: 1 }), // canonical
        assignmentRow({ id: 2, start_time: "10:00:00", end_time: "10:30:00" }), // noncanonical
        assignmentRow({ id: 3, start_time: null }), // unplaceable
      ],
      []
    );
    const { desktopPlaceable, mobilePlaceable } = partitionWorkerSchedule(entries, fakeBlocks);
    const mobileIds = new Set(mobilePlaceable.map((e) => e.id));
    for (const entry of desktopPlaceable) {
      expect(mobileIds.has(entry.id)).toBe(true);
    }
  });

  test("no entry is lost: every entry appears in exactly one region per viewport", () => {
    const entries = normalizeWorkerSchedule(
      [
        assignmentRow({ id: 1 }),
        assignmentRow({ id: 2, start_time: "10:00:00", end_time: "10:30:00" }),
        assignmentRow({ id: 3, weekday: "Domingo" }),
      ],
      [activityRow({ id: 1 })]
    );
    const partition = partitionWorkerSchedule(entries, fakeBlocks);

    // Desktop: every entry is either in desktopPlaceable or in the
    // "outside the grid" leftover, never both, never neither.
    const outsideDesktop = entriesOutsideDesktopGrid(entries, partition);
    for (const entry of entries) {
      const inGrid = partition.desktopPlaceable.some((e) => e.id === entry.id);
      const inLeftover = outsideDesktop.some((e) => e.id === entry.id);
      expect(inGrid !== inLeftover).toBe(true); // exactly one of the two
    }

    // Mobile: every entry is either in mobilePlaceable or in unplaceable,
    // never both, never neither.
    for (const entry of entries) {
      const inAgenda = partition.mobilePlaceable.some((e) => e.id === entry.id);
      const inLeftover = partition.unplaceable.some((e) => e.id === entry.id);
      expect(inAgenda !== inLeftover).toBe(true);
    }
  });

  test("no duplicate entry within desktop's placeable + leftover output", () => {
    const entries = normalizeWorkerSchedule(
      [assignmentRow({ id: 1 }), assignmentRow({ id: 2, weekday: "Domingo" })],
      []
    );
    const partition = partitionWorkerSchedule(entries, fakeBlocks);
    const outsideDesktop = entriesOutsideDesktopGrid(entries, partition);
    const allDesktopIds = [...partition.desktopPlaceable, ...outsideDesktop].map((e) => e.id);
    expect(new Set(allDesktopIds).size).toBe(allDesktopIds.length);
  });

  test("no duplicate entry within mobile's placeable + unplaceable output", () => {
    const entries = normalizeWorkerSchedule(
      [assignmentRow({ id: 1 }), assignmentRow({ id: 2, weekday: "Domingo" })],
      []
    );
    const partition = partitionWorkerSchedule(entries, fakeBlocks);
    const allMobileIds = [...partition.mobilePlaceable, ...partition.unplaceable].map(
      (e) => e.id
    );
    expect(new Set(allMobileIds).size).toBe(allMobileIds.length);
  });
});

describe("compareWorkerScheduleEntries (grid/agenda deterministic sort)", () => {
  const entry = (overrides: Partial<WorkerScheduleEntry>): WorkerScheduleEntry => ({
    kind: "activity",
    id: "activity-1",
    weekday: "Lunes",
    startTime: "07:00:00",
    endTime: "08:50:00",
    activity: "x",
    ...overrides,
  } as WorkerScheduleEntry);

  test("sorts by weekday order first", () => {
    const a = entry({ weekday: "Martes", id: "activity-1" });
    const b = entry({ weekday: "Lunes", id: "activity-2" });
    expect(compareWorkerScheduleEntries(a, b)).toBeGreaterThan(0);
  });

  test("Otro sorts after every recognized weekday", () => {
    const a = entry({ weekday: "Otro", id: "activity-1" });
    const b = entry({ weekday: "Viernes", id: "activity-2" });
    expect(compareWorkerScheduleEntries(a, b)).toBeGreaterThan(0);
  });

  test("within the same weekday, sorts by start time ascending", () => {
    const a = entry({ startTime: "13:10:00", id: "activity-1" });
    const b = entry({ startTime: "07:00:00", id: "activity-2" });
    expect(compareWorkerScheduleEntries(a, b)).toBeGreaterThan(0);
  });

  test("a null start time sorts after every non-null start time within the same weekday", () => {
    const a = entry({ startTime: null, id: "activity-1" });
    const b = entry({ startTime: "07:00:00", id: "activity-2" });
    expect(compareWorkerScheduleEntries(a, b)).toBeGreaterThan(0);
  });

  test("within the same weekday and start time, class sorts before activity", () => {
    const a = entry({ kind: "activity", id: "activity-1" });
    const b = { ...entry({ id: "assignment-1" }), kind: "class", subject: "x", group: "y" } as WorkerScheduleEntry;
    expect(compareWorkerScheduleEntries(a, b)).toBeGreaterThan(0);
  });

  test("a full tie (weekday, start time, kind) is broken by stable id comparison", () => {
    const a = entry({ id: "activity-1" });
    const b = entry({ id: "activity-2" });
    expect(compareWorkerScheduleEntries(a, b)).toBeLessThan(0);
    expect(compareWorkerScheduleEntries(b, a)).toBeGreaterThan(0);
    expect(compareWorkerScheduleEntries(a, a)).toBe(0);
  });

  test("sort order is reproducible regardless of input order", () => {
    const entries = [
      entry({ id: "activity-3", weekday: "Viernes" }),
      entry({ id: "activity-1", weekday: "Lunes" }),
      entry({ id: "activity-2", weekday: "Lunes", startTime: "13:10:00" }),
    ];
    const sortedOnce = sortWorkerScheduleEntries(entries).map((e) => e.id);
    const sortedTwice = sortWorkerScheduleEntries([...entries].reverse()).map((e) => e.id);
    expect(sortedOnce).toEqual(sortedTwice);
  });
});

describe("compareIncompleteScheduleEntries (Horario no especificado sort)", () => {
  const entry = (overrides: Partial<WorkerScheduleEntry>): WorkerScheduleEntry => ({
    kind: "activity",
    id: "activity-1",
    weekday: "Otro",
    startTime: null,
    endTime: null,
    activity: "x",
    ...overrides,
  } as WorkerScheduleEntry);

  test("recognized weekday sorts before Otro", () => {
    const a = entry({ weekday: "Lunes", id: "activity-1" });
    const b = entry({ weekday: "Otro", id: "activity-2" });
    expect(compareIncompleteScheduleEntries(a, b)).toBeLessThan(0);
  });

  test("a valid start time sorts before a missing one, within the same recognized-ness tier", () => {
    const a = entry({ weekday: "Lunes", startTime: "07:00:00", id: "activity-1" });
    const b = entry({ weekday: "Lunes", startTime: null, id: "activity-2" });
    expect(compareIncompleteScheduleEntries(a, b)).toBeLessThan(0);
  });

  test("class sorts before activity within the same weekday/time tier", () => {
    const activityEntry = entry({ weekday: "Otro", id: "activity-1" });
    const classEntry = {
      ...entry({ weekday: "Otro", id: "assignment-1" }),
      kind: "class",
      subject: "x",
      group: "y",
    } as WorkerScheduleEntry;
    expect(compareIncompleteScheduleEntries(classEntry, activityEntry)).toBeLessThan(0);
  });

  test("a full tie is broken by stable id", () => {
    const a = entry({ id: "activity-1" });
    const b = entry({ id: "activity-2" });
    expect(compareIncompleteScheduleEntries(a, b)).toBeLessThan(0);
  });

  test("this comparator is distinct from the grid/agenda comparator for a mixed set", () => {
    const entries = [
      entry({ id: "activity-1", weekday: "Viernes", startTime: null }),
      entry({ id: "activity-2", weekday: "Lunes", startTime: "07:00:00" }),
    ];
    // Grid/agenda comparator would put Lunes first regardless of validity.
    const gridOrder = sortWorkerScheduleEntries(entries).map((e) => e.id);
    // Incomplete comparator: recognized-weekday-and-valid-time wins first
    // regardless of which weekday it is.
    const incompleteOrder = sortIncompleteScheduleEntries(entries).map((e) => e.id);
    expect(gridOrder).toEqual(["activity-2", "activity-1"]);
    expect(incompleteOrder).toEqual(["activity-2", "activity-1"]);
  });
});

describe("groupWorkerScheduleByWeekday", () => {
  test("groups placeable entries under their real weekday, in canonical key order", () => {
    const entries = normalizeWorkerSchedule(
      [assignmentRow({ id: 1, weekday: "Viernes" }), assignmentRow({ id: 2, weekday: "Lunes" })],
      []
    );
    const grouped = groupWorkerScheduleByWeekday(sortWorkerScheduleEntries(entries));
    expect([...grouped.keys()]).toEqual(["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"]);
    expect(grouped.get("Lunes")).toHaveLength(1);
    expect(grouped.get("Viernes")).toHaveLength(1);
    expect(grouped.get("Martes")).toHaveLength(0);
  });
});

describe("selectCellEntries (deterministic desktop grid cell ordering)", () => {
  const classEntry = (overrides: Partial<WorkerScheduleEntry>): WorkerScheduleEntry => ({
    kind: "class",
    id: "assignment-1",
    weekday: "Lunes",
    startTime: "07:00:00",
    endTime: "08:50:00",
    subject: "x",
    group: "y",
    ...overrides,
  } as WorkerScheduleEntry);

  test("only entries matching the exact weekday/startTime/endTime are selected", () => {
    const target = classEntry({ id: "assignment-1" });
    const otherWeekday = classEntry({ id: "assignment-2", weekday: "Martes" });
    const otherTime = classEntry({ id: "assignment-3", startTime: "09:20:00", endTime: "11:10:00" });

    const result = selectCellEntries(
      [target, otherWeekday, otherTime],
      "Lunes",
      "07:00:00",
      "08:50:00"
    );

    expect(result.map((e) => e.id)).toEqual(["assignment-1"]);
  });

  test("multiple entries in one cell are returned in the deterministic grid/agenda order regardless of source-array order", () => {
    const a = classEntry({ id: "assignment-b", kind: "activity", activity: "z" } as never);
    const b = classEntry({ id: "assignment-a" });

    const forwardOrder = selectCellEntries([a, b], "Lunes", "07:00:00", "08:50:00").map((e) => e.id);
    const reversedOrder = selectCellEntries([b, a], "Lunes", "07:00:00", "08:50:00").map((e) => e.id);

    // compareWorkerScheduleEntries: same weekday/time -> kind ("class"
    // before "activity") -> id tie-break. "assignment-a" (class) must sort
    // before "assignment-b" (activity) regardless of input order.
    expect(forwardOrder).toEqual(["assignment-a", "assignment-b"]);
    expect(reversedOrder).toEqual(forwardOrder);
  });

  test("does not mutate the source array", () => {
    const entries = [classEntry({ id: "assignment-b" }), classEntry({ id: "assignment-a" })];
    const before = entries.map((e) => e.id);
    selectCellEntries(entries, "Lunes", "07:00:00", "08:50:00");
    expect(entries.map((e) => e.id)).toEqual(before);
  });

  test("an empty cell returns an empty array", () => {
    const entries = [classEntry({ id: "assignment-1" })];
    expect(selectCellEntries(entries, "Martes", "07:00:00", "08:50:00")).toEqual([]);
  });
});
