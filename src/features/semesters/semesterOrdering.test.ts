import { describe, expect, test } from "bun:test";
import {
  compareSemesters,
  resolveDefaultSemesterId,
  sortSemestersForSelector,
} from "./semesterOrdering";
import type { Semester } from "./useSemesters";

const semester = (overrides: Partial<Semester>): Semester => ({
  id: 1,
  semester: "25A",
  school_year: "2024 - 2025",
  created_at: "2025-01-01T00:00:00Z",
  ...overrides,
});

describe("resolveDefaultSemesterId (never semesters[0])", () => {
  test("selects the chronologically latest valid semester regardless of array order", () => {
    const semesters = [
      semester({ id: 1, semester: "24A" }),
      semester({ id: 2, semester: "26B" }),
      semester({ id: 3, semester: "25A" }),
    ];
    expect(resolveDefaultSemesterId(semesters)).toBe(2);
  });

  test("selecting from a reversed array still returns the same latest semester", () => {
    const semesters = [
      semester({ id: 2, semester: "26B" }),
      semester({ id: 3, semester: "25A" }),
      semester({ id: 1, semester: "24A" }),
    ];
    expect(resolveDefaultSemesterId(semesters)).toBe(2);
  });

  test("an empty array returns null, not a crash or a guessed id", () => {
    expect(resolveDefaultSemesterId([])).toBeNull();
  });

  test("an all-malformed list selects a deterministic item, not null", () => {
    const semesters = [
      semester({ id: 5, semester: "garbage" }),
      semester({ id: 3, semester: "also-bad" }),
    ];
    const result = resolveDefaultSemesterId(semesters);
    expect(result).not.toBeNull();
    expect(result).toBe(3); // lowest id among malformed rows, deterministic
  });

  test("a mixed list of valid and malformed semesters selects the latest valid one, never a malformed one", () => {
    const semesters = [
      semester({ id: 1, semester: "garbage" }),
      semester({ id: 2, semester: "24A" }),
    ];
    expect(resolveDefaultSemesterId(semesters)).toBe(2);
  });
});

describe("sortSemestersForSelector (full deterministic ordering)", () => {
  test("valid semesters sort before malformed ones", () => {
    const semesters = [
      semester({ id: 1, semester: "not-a-code" }),
      semester({ id: 2, semester: "25A" }),
    ];
    const sorted = sortSemestersForSelector(semesters);
    expect(sorted.map((s) => s.id)).toEqual([2, 1]);
  });

  test("valid semesters sort newest first", () => {
    const semesters = [
      semester({ id: 1, semester: "24A" }),
      semester({ id: 2, semester: "26A" }),
      semester({ id: 3, semester: "25B" }),
    ];
    const sorted = sortSemestersForSelector(semesters);
    expect(sorted.map((s) => s.id)).toEqual([2, 3, 1]);
  });

  test("malformed semesters sort after all valid ones, ordered by id ascending", () => {
    const semesters = [
      semester({ id: 9, semester: "bad-2" }),
      semester({ id: 2, semester: "25A" }),
      semester({ id: 5, semester: "bad-1" }),
    ];
    const sorted = sortSemestersForSelector(semesters);
    expect(sorted.map((s) => s.id)).toEqual([2, 5, 9]);
  });

  test("two rows parsing to the identical year/letter are tie-broken deterministically by id", () => {
    const semesters = [
      semester({ id: 7, semester: "25A" }),
      semester({ id: 3, semester: "25A" }),
    ];
    const sorted = sortSemestersForSelector(semesters);
    expect(sorted.map((s) => s.id)).toEqual([3, 7]);
  });

  test("both the 'YYA' and legacy 'YYYY-A' formats sort correctly relative to each other", () => {
    const semesters = [
      semester({ id: 1, semester: "2024-A" }), // legacy format, same as 24A
      semester({ id: 2, semester: "25A" }),
    ];
    const sorted = sortSemestersForSelector(semesters);
    // 25A is chronologically later than 2024-A (=24A), regardless of format.
    expect(sorted.map((s) => s.id)).toEqual([2, 1]);
  });

  test("sort is a total order: no two distinct semesters ever compare as exactly equal unless truly identical", () => {
    const a = semester({ id: 1, semester: "25A" });
    const b = semester({ id: 2, semester: "25A" });
    expect(compareSemesters(a, b)).not.toBe(0);
  });
});
