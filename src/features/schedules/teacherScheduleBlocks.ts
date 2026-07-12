import { SCHEDULE_BLOCKS, type ScheduleBlock } from "./scheduleBlocks";

// The 4 shared blocks are imported from scheduleBlocks.ts, not re-typed --
// this is the only teacher-only addition (the 17:00-19:00 extracurricular
// block). SCHEDULE_BLOCKS itself is never mutated, so scholar scheduling
// stays limited to its original 4 blocks.
export const TEACHER_SCHEDULE_BLOCKS: ScheduleBlock[] = [
  ...SCHEDULE_BLOCKS,
  { start_time: "17:00:00", end_time: "19:00:00", label: "17:00 - 19:00" },
];

/** No two canonical teacher blocks share a start_time, so this is a safe lookup key. */
export function getTeacherBlockByStartTime(
  startTime: string | null | undefined
): ScheduleBlock | undefined {
  if (!startTime) return undefined;
  return TEACHER_SCHEDULE_BLOCKS.find((block) => block.start_time === startTime);
}

/** Exact match on both fields -- used to detect legacy invalid intervals. */
export function getTeacherBlockByTimes(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): ScheduleBlock | undefined {
  if (!startTime || !endTime) return undefined;
  return TEACHER_SCHEDULE_BLOCKS.find(
    (block) => block.start_time === startTime && block.end_time === endTime
  );
}

export function isCanonicalTeacherBlock(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): boolean {
  return getTeacherBlockByTimes(startTime, endTime) !== undefined;
}
