import { TEACHER_SCHEDULE_BLOCKS } from "./teacherScheduleBlocks";
import type { WorkerScheduleEntry } from "./workerScheduleEntry";

// The school's two fixed recess periods, and the desktop-grid row
// sequence that interleaves them with the canonical teachable blocks.
// Recess periods are institutional presentation facts about the school
// day -- NOT Supabase data, NOT inserted into schedule_assignments/
// schedule_teachers, NEVER a WorkerScheduleEntry, and NEVER passed
// through normalizeWorkerSchedule/partitionWorkerSchedule. Nothing in
// this file reads from or writes to any query, service, or the
// normalized schedule contract -- it exists purely to tell the two
// presentation components (WorkerScheduleGrid, WorkerScheduleAgenda)
// where the fixed recess periods sit relative to the real, authorized
// entries those components already receive.
//
// A worker-schedule-scoped constant, deliberately not shared with the
// admin schedule module. The admin grid (RowScholarSchedule.tsx,
// RowTeacherSchedule.tsx) and both PDF exports (ScheduleGroupPDF.tsx,
// ScheduleTeacherPDF.tsx) already render "RECESO" at these same two
// times, each independently, hard-coded inline -- there is no existing
// shared constant even among those four admin call sites. Retrofitting
// all four to consume this constant would touch shipped, tested admin
// schedule/PDF code for a benefit this change doesn't need; recorded as
// a deliberate, documented duplication and a real follow-up (see
// design.md Fixed Follow-ups), not silently accepted.

export const RECESS_LABEL = "RECESO";

// Discriminates a teachable schedule block from a fixed recess period.
export type SchoolDayBlock =
  | {
      kind: "schedule";
      startTime: string;
      endTime: string;
    }
  | {
      kind: "recess";
      startTime: string;
      endTime: string;
      label: typeof RECESS_LABEL;
    };

// Exact times per product requirement.
const RECESS_TIMES: { startTime: string; endTime: string }[] = [
  { startTime: "08:50:00", endTime: "09:20:00" },
  { startTime: "13:00:00", endTime: "13:10:00" },
];

// Renders a raw "HH:mm:ss" pair as this project's existing schedule-block
// label convention -- verified to exactly reproduce every hand-written
// TEACHER_SCHEDULE_BLOCKS label ("7:00 - 8:50", "9:20 - 11:10",
// "11:10 - 13:00", "13:10 - 15:00", "17:00 - 19:00") from its raw
// start_time/end_time, so recess row headers read as the same convention
// as the surrounding schedule rows, not a visually distinct format.
export function formatSchoolDayBlockLabel(startTime: string, endTime: string): string {
  const formatPart = (time: string) => {
    const [hour, minute] = time.split(":");
    return `${Number(hour)}:${minute}`;
  };
  return `${formatPart(startTime)} - ${formatPart(endTime)}`;
}

/**
 * The full desktop-grid row sequence: every canonical teachable block
 * (TEACHER_SCHEDULE_BLOCKS) interleaved with both fixed recess periods,
 * in chronological order. Computed once at module load (string comparison
 * of zero-padded "HH:mm:ss" values is a safe chronological sort here),
 * not re-sorted per render.
 */
export const WORKER_SCHEDULE_DAY_BLOCKS: SchoolDayBlock[] = [
  ...TEACHER_SCHEDULE_BLOCKS.map(
    (block): SchoolDayBlock => ({
      kind: "schedule",
      startTime: block.start_time,
      endTime: block.end_time,
    })
  ),
  ...RECESS_TIMES.map(
    (recess): SchoolDayBlock => ({
      kind: "recess",
      startTime: recess.startTime,
      endTime: recess.endTime,
      label: RECESS_LABEL,
    })
  ),
].sort((a, b) => (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0));

// --- Mobile agenda merge --------------------------------------------

export type WorkerScheduleAgendaItem =
  | { kind: "entry"; id: string; startTime: string | null; entry: WorkerScheduleEntry }
  | { kind: "recess"; id: string; startTime: string; endTime: string; label: typeof RECESS_LABEL };

/**
 * Merges the school's two fixed recess periods into one day's already
 * mobile-placeable entries, in chronological order alongside them.
 * Callers MUST only invoke this for a day that already has at least one
 * real entry to display -- this function itself has no opinion on that;
 * it always returns both recess items regardless of how many entries it
 * receives (including zero), so the "never create an otherwise-empty day
 * solely to show recess" rule is enforced by the caller's own
 * day-selection logic (WorkerScheduleAgenda skips empty days before ever
 * calling this), not by this function refusing to run.
 */
export function mergeRecessIntoDayEntries(
  dayEntries: WorkerScheduleEntry[]
): WorkerScheduleAgendaItem[] {
  const entryItems: WorkerScheduleAgendaItem[] = dayEntries.map((entry) => ({
    kind: "entry",
    id: entry.id,
    startTime: entry.startTime,
    entry,
  }));

  const recessItems: WorkerScheduleAgendaItem[] = RECESS_TIMES.map((recess, index) => ({
    kind: "recess",
    id: `recess-${index}-${recess.startTime}`,
    startTime: recess.startTime,
    endTime: recess.endTime,
    label: RECESS_LABEL,
  }));

  return [...entryItems, ...recessItems].sort((a, b) => {
    // Entries are expected to always carry a valid startTime here (this
    // is only ever called with already mobile-placeable entries), but a
    // null is still handled defensively -- sorted last, never thrown on.
    if (a.startTime === null && b.startTime === null) return 0;
    if (a.startTime === null) return 1;
    if (b.startTime === null) return -1;
    if (a.startTime < b.startTime) return -1;
    if (a.startTime > b.startTime) return 1;
    // Deterministic tie-break for the edge case of a real entry sharing a
    // recess period's exact start time: recess sorts first.
    if (a.kind !== b.kind) return a.kind === "recess" ? -1 : 1;
    return 0;
  });
}
