import type { Semester } from "./useSemesters";

// Deliberately independent from src/helpers/calculateSemesterGroup.ts's
// similar-looking YYA/YYB parsing -- that helper is scoped to the
// schedules module's grade computation, a different concern with a
// different consumer. Keeping this feature's own copy avoids coupling the
// two features together (see design.md Context/Decision 2).
const SEMESTER_CODE_PATTERN = /^(\d{2}|\d{4})-?([AB])$/i;

export interface SemesterCode {
  year: number;
  letter: "A" | "B";
}

/**
 * Parses a semester code into its 4-digit year and term letter. Accepts
 * both the going-forward "YYA"/"YYB" format (e.g. "26A") and the legacy
 * "YYYY-A"/"YYYY-B" format found in existing seed data (e.g. "2026-A").
 * Returns null for anything else -- callers decide how to degrade.
 */
export function parseSemesterCode(
  code: string | null | undefined
): SemesterCode | null {
  const match = code?.trim().toUpperCase().match(SEMESTER_CODE_PATTERN);
  if (!match) return null;

  const rawYear = match[1];
  const letter = match[2] as "A" | "B";
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);

  return { year, letter };
}

/** Formats a semester code in the going-forward "YYA"/"YYB" convention. */
export function formatSemesterCode({ year, letter }: SemesterCode): string {
  return `${(year % 100).toString().padStart(2, "0")}${letter}`;
}

/**
 * Computes the school_year for a semester code: A terms belong to
 * 20(YY-1)-20YY, B terms belong to 20YY-20(YY+1).
 */
export function getSchoolYearForSemester({ year, letter }: SemesterCode): string {
  return letter === "A" ? `${year - 1} - ${year}` : `${year} - ${year + 1}`;
}

function termIndex({ year, letter }: SemesterCode): number {
  return year * 2 + (letter === "A" ? 0 : 1);
}

/** Computes the exact chronological successor of a semester code. */
export function getNextSemester(code: SemesterCode): SemesterCode {
  const nextIndex = termIndex(code) + 1;
  return {
    year: Math.floor(nextIndex / 2),
    letter: nextIndex % 2 === 0 ? "A" : "B",
  };
}

/**
 * Finds the chronologically latest semester among existing records.
 * Semester values that don't match a supported format are skipped (and
 * logged) rather than considered -- they must not corrupt "latest"
 * determination for every semester that does parse correctly.
 */
export function findLatestSemester(semesters: Semester[]): SemesterCode | null {
  let latest: SemesterCode | null = null;

  for (const record of semesters) {
    const parsed = parseSemesterCode(record.semester);
    if (!parsed) {
      console.warn(
        `findLatestSemester: no se pudo interpretar el semestre "${record.semester}" (id ${record.id}), se omitió`
      );
      continue;
    }
    if (!latest || termIndex(parsed) > termIndex(latest)) {
      latest = parsed;
    }
  }

  return latest;
}
