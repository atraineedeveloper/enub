import type { MyDateOfAdmission, MySustenancePlaza } from "../../services/apiWorkers";

// Exact, final label/fallback text for the read-only "Mi información" page.
// Pure, individually-tested mapping functions -- no component reaches into
// raw field/relation values directly.

export const STATUS_ACTIVE_LABEL = "Activo";
export const STATUS_INACTIVE_LABEL = "Inactivo";
export const STATUS_UNKNOWN_LABEL = "Estado desconocido";
export const NOT_ON_FILE_LABEL = "No registrado";
export const WORKER_TYPE_UNSPECIFIED_LABEL = "Tipo no especificado";
export const DATE_NOT_ON_FILE_LABEL = "Fecha no registrada";
export const NO_SUSTENANCE_PLAZAS_LABEL = "No tienes plazas registradas.";
export const NO_DATE_OF_ADMISSIONS_LABEL =
  "No tienes fechas de admisión registradas.";

/**
 * Exactly: 1 -> "Activo", 0 -> "Inactivo", anything else (including null,
 * undefined, or a non-numeric/malformed value) -> "Estado desconocido".
 * Never guesses Activo/Inactivo for an unrecognized value -- matches
 * WorkerRow.tsx's existing `status === 1 ? "Activo" : "Inactivo"` for the
 * two known cases, but adds the explicit third state that component never
 * needed (an admin-authored row is always 0/1 in practice; a worker's own
 * self-service view can't assume that).
 */
export function translateWorkerStatus(
  status: number | null | undefined
): string {
  if (status === 1) return STATUS_ACTIVE_LABEL;
  if (status === 0) return STATUS_INACTIVE_LABEL;
  return STATUS_UNKNOWN_LABEL;
}

/**
 * Missing/empty value -> "No registrado". Shared by every plain optional
 * text field on the profile: email, phone, RFC, street, neighborhood,
 * post_code, city, state, specialty, function_performed, and a plaza's
 * own sustenance/payment_key/plaza fields.
 */
export function formatOptionalWorkerField(
  value: string | null | undefined
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : NOT_ON_FILE_LABEL;
}

/** Missing/empty type_worker -> the distinct "Tipo no especificado" text. */
export function formatWorkerType(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : WORKER_TYPE_UNSPECIFIED_LABEL;
}

/** Missing/empty admission-date type -> the same distinct "Tipo no especificado" wording as type_worker. */
export function formatDateOfAdmissionType(
  value: string | null | undefined
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : WORKER_TYPE_UNSPECIFIED_LABEL;
}

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_NAMES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

// Non-leap-year day counts; February is resolved separately via
// isLeapYear() below rather than hardcoded as 28 or 29 here.
const DAYS_IN_MONTH: readonly number[] = [
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
];

/**
 * Gregorian leap-year rule via plain arithmetic, never a `Date` object:
 * divisible by 4, except centuries (divisible by 100), except again every
 * 4th century (divisible by 400). 2000 and 2024 are leap; 1900 and 2023
 * are not.
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export interface CivilDate {
  year: number;
  /** 1-12, not a zero-based JS Date month index. */
  month: number;
  day: number;
}

/**
 * Parses a `date` column value ("YYYY-MM-DD", Postgres's `date` type has
 * no time/zone component) into its three numeric components -- shared,
 * single source of truth for every place in this module that needs to
 * know whether a stored date string denotes a real calendar date, used by
 * both `formatCivilDate` (display) and `sortDateOfAdmissions` (ordering).
 * Deliberately never constructs a `Date` object anywhere: `new
 * Date("2024-08-16")` parses as UTC midnight, and formatting that in any
 * timezone behind UTC (most of Mexico) renders the PREVIOUS day -- a real,
 * well-known off-by-one bug; relying on `Date` for calendar validation
 * (e.g. checking whether `new Date(2024, 1, 30)` "rolled over") has the
 * identical timezone exposure. This function only ever does string/number
 * arithmetic on the three regex-captured components, plus the explicit
 * `isLeapYear`/`DAYS_IN_MONTH` rule above, so there is no timezone
 * interpretation anywhere in the code path to get wrong, and an
 * out-of-range month or a day that doesn't exist in that specific
 * month/year (April 31, non-leap February 29, ...) is rejected rather
 * than silently normalized. Returns `null` for anything that isn't a real
 * calendar date in exactly "YYYY-MM-DD" shape (including null/undefined/
 * empty/malformed input).
 */
export function parseCivilDate(value: string | null | undefined): CivilDate | null {
  if (!value) return null;
  const match = CIVIL_DATE_PATTERN.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) return null;

  const daysInMonth = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > daysInMonth) return null;

  return { year, month, day };
}

/**
 * Formats a `date` column value as a Spanish civil date, e.g.
 * "2024-08-16" -> "16 de agosto de 2024", via `parseCivilDate` -- never
 * its own, separately-maintained parsing/validation logic. Returns `null`
 * for anything `parseCivilDate` rejects; the caller decides the
 * placeholder (see `formatDateOfAdmissionValue`).
 */
export function formatCivilDate(value: string | null | undefined): string | null {
  const parsed = parseCivilDate(value);
  if (!parsed) return null;

  return `${parsed.day} de ${MONTH_NAMES_ES[parsed.month - 1]} de ${parsed.year}`;
}

/** A date_of_admission value, formatted or replaced with its exact fallback text. */
export function formatDateOfAdmissionValue(
  value: string | null | undefined
): string {
  return formatCivilDate(value) ?? DATE_NOT_ON_FILE_LABEL;
}

/**
 * Compares two optional text values for sorting: a real, human-language
 * comparison (`localeCompare`, so accented letters like "Ñ" sort where a
 * Spanish speaker expects) with a blank/null value always sorting last,
 * regardless of locale collation quirks -- explicit, not a sentinel
 * character relying on how a particular collation orders it.
 */
function compareOptionalText(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const trimmedA = a?.trim() ?? "";
  const trimmedB = b?.trim() ?? "";
  if (!trimmedA && !trimmedB) return 0;
  if (!trimmedA) return 1;
  if (!trimmedB) return -1;
  return trimmedA.localeCompare(trimmedB, "es");
}

/**
 * Deterministic display order for a worker's sustenance_plazas, independent
 * of whatever order Postgres/PostgREST happened to return them in: by
 * sustenance, then plaza, then payment_key; a missing value in any key
 * sorts last within that key. Returns a new array; never mutates the
 * input. Two rows identical on all three keys (a data-quality edge case,
 * not a normal one) fall back to Array.sort's guaranteed stability --
 * their relative input order -- since no `id` is fetched for this view
 * (deliberately excluded as an internal identifier, see apiWorkers.ts).
 */
export function sortSustenancePlazas(
  plazas: MySustenancePlaza[]
): MySustenancePlaza[] {
  return [...plazas].sort((a, b) => {
    const sustenanceDiff = compareOptionalText(a.sustenance, b.sustenance);
    if (sustenanceDiff !== 0) return sustenanceDiff;

    const plazaDiff = compareOptionalText(a.plaza, b.plaza);
    if (plazaDiff !== 0) return plazaDiff;

    return compareOptionalText(a.payment_key, b.payment_key);
  });
}

/**
 * Deterministic chronological order for a worker's date_of_admissions,
 * independent of return order: by `date_of_admission` ascending -- plain
 * ordinal string comparison is sufficient and intentional here ("YYYY-MM-DD"
 * sorts chronologically as text, no Date parsing/timezone involved at
 * all) once a value is confirmed to be a REAL calendar date via
 * `parseCivilDate` (the same function `formatCivilDate` uses -- a
 * shape-only regex check would wrongly treat a non-existent date like
 * "2024-04-31" as sortable-in-place instead of invalid). A missing or
 * genuinely invalid date sorts last, then by `type` as a stable tie-break.
 * Returns a new array; never mutates the input.
 */
export function sortDateOfAdmissions(
  dates: MyDateOfAdmission[]
): MyDateOfAdmission[] {
  const dateKey = (value: string | null) => {
    const trimmed = value?.trim();
    return trimmed && parseCivilDate(trimmed) ? trimmed : null;
  };

  return [...dates].sort((a, b) => {
    const dateA = dateKey(a.date_of_admission);
    const dateB = dateKey(b.date_of_admission);
    if (dateA !== dateB) {
      if (dateA === null) return 1;
      if (dateB === null) return -1;
      return dateA < dateB ? -1 : 1;
    }

    return compareOptionalText(a.type, b.type);
  });
}
