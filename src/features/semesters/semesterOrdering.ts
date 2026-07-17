import { parseSemesterCode } from "./nextSemesterCode";
import type { Semester } from "./useSemesters";

// Matches nextSemesterCode.ts's own internal termIndex formula exactly
// (year * 2 + (letter === "A" ? 0 : 1)) -- duplicated here rather than
// exported from that module, since it's a one-line computation and this
// module's ordering/tie-break concerns are distinct from that module's
// "next semester code" concern (same reasoning nextSemesterCode.ts already
// gives for keeping its own semester-code parsing independent of
// calculateSemesterGroup.ts's similar-looking parsing).
function termIndex(year: number, letter: "A" | "B"): number {
  return year * 2 + (letter === "A" ? 0 : 1);
}

/**
 * Total order for the semester selector (design.md "Semester selection"):
 * every semester whose code parses sorts before every semester whose code
 * doesn't; among parsed ones, newest first, with an id-ascending tie-break
 * for two rows that parse to the identical year/letter; among unparsed
 * ("malformed") ones, id ascending is the only remaining stable key. No
 * two distinct semesters can ever compare equal.
 */
export function compareSemesters(a: Semester, b: Semester): number {
  const parsedA = parseSemesterCode(a.semester);
  const parsedB = parseSemesterCode(b.semester);

  if (parsedA && !parsedB) return -1;
  if (!parsedA && parsedB) return 1;

  if (parsedA && parsedB) {
    const indexDiff = termIndex(parsedB.year, parsedB.letter) - termIndex(parsedA.year, parsedA.letter);
    if (indexDiff !== 0) return indexDiff;
    return a.id - b.id;
  }

  // Both malformed.
  return a.id - b.id;
}

export function sortSemestersForSelector(semesters: Semester[]): Semester[] {
  return [...semesters].sort(compareSemesters);
}

/**
 * The default semester id: the first item under compareSemesters's order --
 * a valid, chronologically-latest semester whenever at least one exists;
 * otherwise the deterministic first malformed semester (a semester row
 * genuinely exists, so this is not the "no semesters" case); otherwise
 * `null` only when the array itself is empty. Deliberately not
 * `semesters[0]` -- see WorkerDocumentsView.tsx's unordered use of that
 * exact pattern, which this change documents as a defect and does not
 * repeat.
 */
export function resolveDefaultSemesterId(semesters: Semester[]): number | null {
  if (semesters.length === 0) return null;
  return sortSemestersForSelector(semesters)[0].id;
}
