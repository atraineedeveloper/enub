import { describe, expect, test } from "bun:test";
import {
  formatFriendlySemesterPeriod,
  formatSemesterPeriodWithCode,
} from "./semesterDisplayLabel";

describe("formatFriendlySemesterPeriod", () => {
  test("an A term (febrero-julio) stays within one calendar year", () => {
    expect(formatFriendlySemesterPeriod("24A")).toBe("Febrero–julio 2024");
  });

  test("a B term (agosto-enero) crosses into the following calendar year", () => {
    expect(formatFriendlySemesterPeriod("24B")).toBe(
      "Agosto 2024 – enero 2025"
    );
  });

  test("the legacy 'YYYY-A' format parses the same as the short form", () => {
    expect(formatFriendlySemesterPeriod("2024-A")).toBe(
      "Febrero–julio 2024"
    );
  });

  test("a lowercase code still parses", () => {
    expect(formatFriendlySemesterPeriod("24b")).toBe(
      "Agosto 2024 – enero 2025"
    );
  });

  test("null, undefined and empty input return an empty string", () => {
    expect(formatFriendlySemesterPeriod(null)).toBe("");
    expect(formatFriendlySemesterPeriod(undefined)).toBe("");
    expect(formatFriendlySemesterPeriod("")).toBe("");
  });

  test("an unparseable code falls back to the trimmed raw value, not a crash", () => {
    expect(formatFriendlySemesterPeriod("  not-a-code  ")).toBe(
      "not-a-code"
    );
  });
});

describe("formatSemesterPeriodWithCode", () => {
  test("an A term includes the short code as a secondary reference", () => {
    expect(formatSemesterPeriodWithCode("24A")).toBe(
      "Febrero–julio 2024 · 24A"
    );
  });

  test("a B term includes the short code as a secondary reference", () => {
    expect(formatSemesterPeriodWithCode("24B")).toBe(
      "Agosto 2024 – enero 2025 · 24B"
    );
  });

  test("a legacy 'YYYY-A' code normalizes the displayed reference to the short form", () => {
    expect(formatSemesterPeriodWithCode("2024-A")).toBe(
      "Febrero–julio 2024 · 24A"
    );
  });

  test("null, undefined and empty input return an empty string", () => {
    expect(formatSemesterPeriodWithCode(null)).toBe("");
    expect(formatSemesterPeriodWithCode(undefined)).toBe("");
    expect(formatSemesterPeriodWithCode("")).toBe("");
  });

  test("an unparseable code is shown once, not duplicated", () => {
    expect(formatSemesterPeriodWithCode("garbage")).toBe("garbage");
  });
});
