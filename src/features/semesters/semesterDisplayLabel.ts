import { formatSemesterCode, parseSemesterCode } from "./nextSemesterCode";

// Project convention (not derived from `school_year`, which is free-text
// and not always consistent with the code): term A runs febrero-julio,
// term B runs agosto-enero of the following calendar year.
const TERM_MONTHS = {
  A: { start: "febrero", end: "julio" },
  B: { start: "agosto", end: "enero" },
} as const;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Human-friendly academic-period label for a semester code, e.g.
 * "24A" -> "Febrero–julio 2024", "24B" -> "Agosto 2024 – enero 2025"
 * (term B's end month falls in the following calendar year). Accepts both
 * the "YYA"/"YYB" and legacy "YYYY-A"/"YYYY-B" formats via
 * parseSemesterCode. Falls back to the trimmed raw code when it can't be
 * parsed, so unrecognized/legacy values degrade to today's plain-code
 * display instead of an empty or broken label.
 */
export function formatFriendlySemesterPeriod(
  code: string | null | undefined
): string {
  const parsed = parseSemesterCode(code);
  if (!parsed) return code?.trim() ?? "";

  const { year, letter } = parsed;
  const { start, end } = TERM_MONTHS[letter];

  if (letter === "A") {
    return `${capitalize(start)}–${end} ${year}`;
  }

  return `${capitalize(start)} ${year} – ${end} ${year + 1}`;
}

/**
 * Friendly period label plus the internal semester code as a secondary
 * reference, e.g. "Febrero–julio 2024 · 24A" -- for anyone
 * cross-referencing the stored value. The code itself is never altered;
 * when the input uses the legacy "YYYY-A" format it is normalized to the
 * short "YYA" form for display only (via formatSemesterCode), matching
 * what CreateSemesterForm.tsx generates for new records. Falls back to the
 * raw code alone when it can't be parsed (no point showing it twice).
 */
export function formatSemesterPeriodWithCode(
  code: string | null | undefined
): string {
  const trimmedCode = code?.trim();
  if (!trimmedCode) return "";

  const parsed = parseSemesterCode(trimmedCode);
  if (!parsed) return trimmedCode;

  const friendly = formatFriendlySemesterPeriod(trimmedCode);
  const displayCode = formatSemesterCode(parsed);
  return `${friendly} · ${displayCode}`;
}
