import {
  normalizeWorkerSchedule,
  type RawWorkerScheduleAssignmentRow,
  type RawWorkerScheduleTeacherRow,
  type WorkerScheduleEntry,
} from "./workerScheduleEntry";
import type { Semester } from "../semesters/useSemesters";

export type MyScheduleViewState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "no-semesters" }
  | { status: "empty-schedule" }
  | { status: "ready"; entries: WorkerScheduleEntry[] };

export interface MyScheduleViewInput {
  isLoadingSemesters: boolean;
  semestersError: unknown;
  semesters: Semester[] | undefined;
  selectedSemesterId: number | null;
  isLoadingAssignments: boolean;
  assignmentsError: unknown;
  scheduleAssignments: RawWorkerScheduleAssignmentRow[] | undefined;
  isLoadingActivities: boolean;
  activitiesError: unknown;
  scheduleTeacherActivities: RawWorkerScheduleTeacherRow[] | undefined;
}

/**
 * Single source of truth for what MyScheduleView renders (audit finding:
 * error/partial-result behavior). A failure of the semesters query, the
 * assignments query, OR the activities query alone -- in any combination,
 * including just one of the two schedule queries while the other succeeds
 * -- always resolves to the SAME single "error" state, never partial
 * content built from whichever query happened to succeed. This is a
 * deliberate product rule, not an oversight: a worker seeing half their
 * schedule with no indication the other half failed to load is worse than
 * a single, honest error message. A database/query error is also never
 * conflated with "empty-schedule" (both succeeded, zero rows) -- those are
 * two distinct, separately labeled states.
 */
export function resolveMyScheduleViewState(input: MyScheduleViewInput): MyScheduleViewState {
  const anyError = Boolean(
    input.semestersError || input.assignmentsError || input.activitiesError
  );
  if (anyError) return { status: "error" };

  if (input.isLoadingSemesters) return { status: "loading" };

  if (!input.semesters || input.semesters.length === 0) {
    return { status: "no-semesters" };
  }

  if (
    input.selectedSemesterId === null ||
    input.isLoadingAssignments ||
    input.isLoadingActivities ||
    !input.scheduleAssignments ||
    !input.scheduleTeacherActivities
  ) {
    return { status: "loading" };
  }

  const entries = normalizeWorkerSchedule(
    input.scheduleAssignments,
    input.scheduleTeacherActivities
  );

  if (entries.length === 0) return { status: "empty-schedule" };

  return { status: "ready", entries };
}
