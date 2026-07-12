// Single source of truth for the 4 canonical scholar-schedule academic
// blocks -- the form, the table rows, and the service-layer validation all
// derive from this file rather than each hardcoding the same 4 intervals.
export interface ScheduleBlock {
  start_time: string;
  end_time: string;
  label: string;
}

export const SCHEDULE_BLOCKS: ScheduleBlock[] = [
  { start_time: "07:00:00", end_time: "08:50:00", label: "7:00 - 8:50" },
  { start_time: "09:20:00", end_time: "11:10:00", label: "9:20 - 11:10" },
  { start_time: "11:10:00", end_time: "13:00:00", label: "11:10 - 13:00" },
  { start_time: "13:10:00", end_time: "15:00:00", label: "13:10 - 15:00" },
];

/** No two canonical blocks share a start_time, so this is a safe lookup key. */
export function getBlockByStartTime(
  startTime: string | null | undefined
): ScheduleBlock | undefined {
  if (!startTime) return undefined;
  return SCHEDULE_BLOCKS.find((block) => block.start_time === startTime);
}

/** Exact match on both fields -- used to detect legacy invalid intervals. */
export function getBlockByTimes(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): ScheduleBlock | undefined {
  if (!startTime || !endTime) return undefined;
  return SCHEDULE_BLOCKS.find(
    (block) => block.start_time === startTime && block.end_time === endTime
  );
}

export function isCanonicalBlock(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): boolean {
  return getBlockByTimes(startTime, endTime) !== undefined;
}
