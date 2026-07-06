// Minimal structural types covering only the fields these functions read.
// `existingSchedules` stays `unknown[]` (cast per-item below) because real
// callers pass several different shapes into it: mixed
// ScheduleAssignment[]/ScheduleTeacher[] arrays
// (CreateEditTeacherSchedule.tsx's `[...scheduleTeachers, ...scheduleAssignments]`)
// and a `SemesterContext`-sourced array still typed `unknown[]` upstream
// (CreateEditScholarSchedule.tsx) -- narrowing this parameter to a specific
// interface would break that already-typed call site. `data` (react-hook-form's
// `FieldValues`, a `Record<string, any>`) already satisfies the structural
// types below without widening.
interface ScheduleConflictWorkerItem {
  id?: number | null;
  worker_id?: number | string | null;
  weekday?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

interface ScheduleConflictGroupItem {
  id?: number | null;
  group_id?: number | string | null;
  weekday?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

/**
 * Detects if a worker already has a schedule entry at the same day and overlapping time.
 * Works for both scholar assignments and teacher activities.
 *
 * @param existingSchedules - Array of schedules to check against
 * @param data - The new schedule data (worker_id, weekday, start_time, end_time)
 * @param excludeId - ID to exclude (used when editing an existing record)
 * @returns true if there is a conflict
 */
export function hasWorkerConflict(
  existingSchedules: unknown[],
  data: ScheduleConflictWorkerItem,
  excludeId: number | null = null
): boolean {
  return existingSchedules.some((item) => {
    const schedule = item as ScheduleConflictWorkerItem;
    if (excludeId && schedule.id === excludeId) return false;
    if (+schedule.worker_id! !== +data.worker_id!) return false;
    if (schedule.weekday !== data.weekday) return false;
    return data.start_time! < schedule.end_time! && schedule.start_time! < data.end_time!;
  });
}

/**
 * Detects if a group already has a class at the same day and overlapping time.
 *
 * @param existingSchedules - Array of scholar schedule assignments
 * @param data - The new schedule data (group_id, weekday, start_time, end_time)
 * @param excludeId - ID to exclude (used when editing an existing record)
 * @returns true if there is a conflict
 */
export function hasGroupConflict(
  existingSchedules: unknown[],
  data: ScheduleConflictGroupItem,
  excludeId: number | null = null
): boolean {
  return existingSchedules.some((item) => {
    const schedule = item as ScheduleConflictGroupItem;
    if (excludeId && schedule.id === excludeId) return false;
    if (+schedule.group_id! !== +data.group_id!) return false;
    if (schedule.weekday !== data.weekday) return false;
    return data.start_time! < schedule.end_time! && schedule.start_time! < data.end_time!;
  });
}
