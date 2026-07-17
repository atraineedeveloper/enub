import { WEEKDAYS } from "../../helpers/constants";
import { isCanonicalBlock } from "./scheduleBlocks";
import { isCanonicalTeacherBlock } from "./teacherScheduleBlocks";

// The canonical weekday order this feature's sorting/grouping is built on,
// derived from the same WEEKDAYS constant CreateEditTeacherSchedule.tsx
// already uses -- not a separately maintained list.
const CANONICAL_WEEKDAYS = WEEKDAYS.map((day) => day.value);

export type NormalizedWeekday = (typeof CANONICAL_WEEKDAYS)[number] | "Otro";

export const FALLBACK_TIME_LABEL = "Hora no especificada";
export const FALLBACK_WEEKDAY_LABEL = "Día no especificado";
export const FALLBACK_SUBJECT_LABEL = "Materia no especificada";
export const FALLBACK_GROUP_LABEL = "Grupo no especificado";
export const FALLBACK_ACTIVITY_LABEL = "Actividad no especificada";

export interface WorkerClassEntry {
  kind: "class";
  id: string;
  weekday: NormalizedWeekday;
  startTime: string | null;
  endTime: string | null;
  subject: string;
  group: string;
}

export interface WorkerActivityEntry {
  kind: "activity";
  id: string;
  weekday: NormalizedWeekday;
  startTime: string | null;
  endTime: string | null;
  activity: string;
}

export type WorkerScheduleEntry = WorkerClassEntry | WorkerActivityEntry;

// --- Normalization inputs (the exact shape apiWorkerSchedule.ts's narrow
// projections return) -------------------------------------------------

export interface RawWorkerScheduleAssignmentRow {
  id: number;
  weekday: string | null;
  start_time: string | null;
  end_time: string | null;
  subjects: { name: string | null } | null;
  groups:
    | {
        letter: string | null;
        year_of_admission: number | null;
        degrees: { code: string | null; name: string | null } | null;
      }
    | null;
}

export interface RawWorkerScheduleTeacherRow {
  id: number;
  weekday: string | null;
  start_time: string | null;
  end_time: string | null;
  activity: string | null;
}

// A time value is only trusted as "valid" when it is a real, in-range
// non-timezone clock time -- hours 00-23, minutes 00-59, seconds 00-59
// when present. The database's `time without time zone` columns are
// populated exclusively from the canonical block dropdowns
// (SCHEDULE_BLOCKS/TEACHER_SCHEDULE_BLOCKS, always "HH:mm:ss") today, but
// this validates the raw string directly rather than trusting that
// convention -- a legacy/malformed row (e.g. "99:99:99", "24:00:00",
// "23:59:60") must never be accepted as a real time. `HH:mm` is also
// accepted (a plausible alternate source-of-truth shape) and normalized up
// to `HH:mm:00` so canonical-block string comparisons (which are always
// "HH:mm:ss") keep working regardless of which shape a row arrived in.
// Never a Date object or timezone conversion -- these are wall-clock
// values with no date/zone component to begin with.
const TIME_WITH_SECONDS_PATTERN = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
const TIME_WITHOUT_SECONDS_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeTime(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  if (TIME_WITH_SECONDS_PATTERN.test(value)) return value;
  if (TIME_WITHOUT_SECONDS_PATTERN.test(value)) return `${value}:00`;
  return null;
}

function normalizeWeekday(value: string | null | undefined): NormalizedWeekday {
  if (typeof value === "string" && (CANONICAL_WEEKDAYS as readonly string[]).includes(value)) {
    return value as NormalizedWeekday;
  }
  return "Otro";
}

function formatGroupLabel(groups: RawWorkerScheduleAssignmentRow["groups"]): string {
  if (!groups) return FALLBACK_GROUP_LABEL;

  const identity = [groups.year_of_admission ?? undefined, groups.letter ?? undefined]
    .filter((part): part is string | number => part !== undefined && part !== "")
    .join(" ");
  const degreeCode = groups.degrees?.code ?? "";

  if (!identity && !degreeCode) return FALLBACK_GROUP_LABEL;
  if (!degreeCode) return identity;
  if (!identity) return degreeCode;
  return `${identity} - ${degreeCode}`;
}

/**
 * Maps both raw source arrays into the single normalized contract every
 * presentation consumes. Every authorized row is represented -- a null or
 * malformed time, or an unrecognized weekday, never causes a row to be
 * dropped; it only affects the fields' own values (never blanking the
 * entry's other, valid fields) and, later, which viewport(s) can place it
 * (see workerSchedulePlacement.ts).
 */
export function normalizeWorkerSchedule(
  assignments: RawWorkerScheduleAssignmentRow[],
  activities: RawWorkerScheduleTeacherRow[]
): WorkerScheduleEntry[] {
  const classEntries: WorkerClassEntry[] = assignments.map((row) => ({
    kind: "class",
    id: `assignment-${row.id}`,
    weekday: normalizeWeekday(row.weekday),
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    subject: row.subjects?.name?.trim() || FALLBACK_SUBJECT_LABEL,
    group: formatGroupLabel(row.groups),
  }));

  const activityEntries: WorkerActivityEntry[] = activities.map((row) => ({
    kind: "activity",
    id: `activity-${row.id}`,
    weekday: normalizeWeekday(row.weekday),
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    activity: row.activity?.trim() || FALLBACK_ACTIVITY_LABEL,
  }));

  return [...classEntries, ...activityEntries];
}

export function formatScheduleWeekday(weekday: NormalizedWeekday): string {
  return weekday === "Otro" ? FALLBACK_WEEKDAY_LABEL : weekday;
}

export function formatScheduleTime(
  startTime: string | null,
  endTime: string | null
): string {
  if (!startTime || !endTime) return FALLBACK_TIME_LABEL;
  return `${startTime.slice(0, 5)}–${endTime.slice(0, 5)}`;
}

// --- Placement -----------------------------------------------------

export interface CanonicalBlockLookup {
  isCanonicalClassBlock: (start: string, end: string) => boolean;
  isCanonicalActivityBlock: (start: string, end: string) => boolean;
}

// The real lookup used in production, backed by the existing canonical
// block sources (scheduleBlocks.ts / teacherScheduleBlocks.ts) -- exported
// so callers don't need to reconstruct it, while tests can still supply a
// fake CanonicalBlockLookup directly to partitionWorkerSchedule.
export const defaultCanonicalBlockLookup: CanonicalBlockLookup = {
  isCanonicalClassBlock: isCanonicalBlock,
  isCanonicalActivityBlock: isCanonicalTeacherBlock,
};

export interface WorkerSchedulePartition {
  desktopPlaceable: WorkerScheduleEntry[];
  mobilePlaceable: WorkerScheduleEntry[];
  unplaceable: WorkerScheduleEntry[];
}

function hasValidTime(entry: WorkerScheduleEntry): entry is WorkerScheduleEntry & {
  startTime: string;
  endTime: string;
} {
  return entry.startTime !== null && entry.endTime !== null;
}

function isMobilePlaceable(entry: WorkerScheduleEntry): boolean {
  return entry.weekday !== "Otro" && hasValidTime(entry);
}

function isDesktopPlaceable(
  entry: WorkerScheduleEntry,
  scheduleBlocks: CanonicalBlockLookup
): boolean {
  if (!isMobilePlaceable(entry) || !hasValidTime(entry)) return false;
  return entry.kind === "class"
    ? scheduleBlocks.isCanonicalClassBlock(entry.startTime, entry.endTime)
    : scheduleBlocks.isCanonicalActivityBlock(entry.startTime, entry.endTime);
}

/**
 * Pure placement partition (design.md §9a): every entry is classified into
 * mobilePlaceable (recognized weekday + valid time, canonical alignment not
 * required), desktopPlaceable (mobilePlaceable AND aligned to a configured
 * canonical block for its kind -- always a subset of mobilePlaceable), and
 * unplaceable (everything not in mobilePlaceable). No entry is ever
 * dropped: every entry in `entries` appears in exactly one of
 * desktopPlaceable / (mobilePlaceable minus desktopPlaceable) / unplaceable.
 */
export function partitionWorkerSchedule(
  entries: WorkerScheduleEntry[],
  scheduleBlocks: CanonicalBlockLookup = defaultCanonicalBlockLookup
): WorkerSchedulePartition {
  const desktopPlaceable: WorkerScheduleEntry[] = [];
  const mobilePlaceable: WorkerScheduleEntry[] = [];
  const unplaceable: WorkerScheduleEntry[] = [];

  for (const entry of entries) {
    if (isMobilePlaceable(entry)) {
      mobilePlaceable.push(entry);
      if (isDesktopPlaceable(entry, scheduleBlocks)) {
        desktopPlaceable.push(entry);
      }
    } else {
      unplaceable.push(entry);
    }
  }

  return { desktopPlaceable, mobilePlaceable, unplaceable };
}

/** Every entry not in desktopPlaceable -- what desktop's "Horario no especificado" section shows. */
export function entriesOutsideDesktopGrid(
  entries: WorkerScheduleEntry[],
  partition: WorkerSchedulePartition
): WorkerScheduleEntry[] {
  const desktopIds = new Set(partition.desktopPlaceable.map((entry) => entry.id));
  return entries.filter((entry) => !desktopIds.has(entry.id));
}

// --- Sorting ---------------------------------------------------------

function weekdayRank(weekday: NormalizedWeekday): number {
  const index = (CANONICAL_WEEKDAYS as readonly string[]).indexOf(weekday);
  return index === -1 ? CANONICAL_WEEKDAYS.length : index; // "Otro" sorts last
}

function kindRank(kind: WorkerScheduleEntry["kind"]): number {
  return kind === "class" ? 0 : 1;
}

/**
 * Grid/agenda placement sort (design.md §9b): weekday (canonical order,
 * "Otro" last) -> start time ascending (null last) -> kind (class before
 * activity) -> id (stable tie-break). A total order -- two distinct
 * entries never compare equal.
 */
export function compareWorkerScheduleEntries(
  a: WorkerScheduleEntry,
  b: WorkerScheduleEntry
): number {
  const weekdayDiff = weekdayRank(a.weekday) - weekdayRank(b.weekday);
  if (weekdayDiff !== 0) return weekdayDiff;

  if (a.startTime !== b.startTime) {
    if (a.startTime === null) return 1;
    if (b.startTime === null) return -1;
    if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
  }

  const kindDiff = kindRank(a.kind) - kindRank(b.kind);
  if (kindDiff !== 0) return kindDiff;

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortWorkerScheduleEntries(
  entries: WorkerScheduleEntry[]
): WorkerScheduleEntry[] {
  return [...entries].sort(compareWorkerScheduleEntries);
}

/**
 * Pure selector for a single grid cell: every entry matching this exact
 * weekday/startTime/endTime, in the deterministic grid/agenda order
 * (compareWorkerScheduleEntries). Extracted so WorkerScheduleGrid.tsx's
 * rendered cell order never depends on the source array's own order --
 * two equivalent-but-differently-ordered input arrays must always
 * produce identical rendered order for the same cell. Never mutates
 * `entries`.
 */
export function selectCellEntries(
  entries: WorkerScheduleEntry[],
  weekday: NormalizedWeekday,
  startTime: string,
  endTime: string
): WorkerScheduleEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.weekday === weekday && entry.startTime === startTime && entry.endTime === endTime
    )
    .sort(compareWorkerScheduleEntries);
}

/**
 * "Horario no especificado" sort (design.md §9b): deliberately coarser than
 * the grid/agenda sort -- recognized weekday before "Otro" -> non-null
 * start time before null -> kind -> id. This section's members are exactly
 * the ones where the real weekday/time values are least reliable, so this
 * comparator sorts on whether each is present/recognized, not its value.
 */
export function compareIncompleteScheduleEntries(
  a: WorkerScheduleEntry,
  b: WorkerScheduleEntry
): number {
  const aRecognized = a.weekday !== "Otro" ? 0 : 1;
  const bRecognized = b.weekday !== "Otro" ? 0 : 1;
  if (aRecognized !== bRecognized) return aRecognized - bRecognized;

  const aHasStart = a.startTime !== null ? 0 : 1;
  const bHasStart = b.startTime !== null ? 0 : 1;
  if (aHasStart !== bHasStart) return aHasStart - bHasStart;

  const kindDiff = kindRank(a.kind) - kindRank(b.kind);
  if (kindDiff !== 0) return kindDiff;

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortIncompleteScheduleEntries(
  entries: WorkerScheduleEntry[]
): WorkerScheduleEntry[] {
  return [...entries].sort(compareIncompleteScheduleEntries);
}

// --- Grouping ---------------------------------------------------------

export type WorkerScheduleByWeekday = Map<
  Exclude<NormalizedWeekday, "Otro">,
  WorkerScheduleEntry[]
>;

/**
 * Groups an already-sorted (via compareWorkerScheduleEntries) placeable
 * array by its real weekday, in canonical order. Only ever called with
 * placeable entries (weekday !== "Otro" by construction), so every key is
 * a real weekday.
 */
export function groupWorkerScheduleByWeekday(
  sortedEntries: WorkerScheduleEntry[]
): WorkerScheduleByWeekday {
  const grouped: WorkerScheduleByWeekday = new Map();

  for (const day of CANONICAL_WEEKDAYS) {
    grouped.set(day, []);
  }

  for (const entry of sortedEntries) {
    if (entry.weekday === "Otro") continue; // never true for placeable entries
    grouped.get(entry.weekday)?.push(entry);
  }

  return grouped;
}
