import supabase from "./supabase";
import type {
  RawWorkerScheduleAssignmentRow,
  RawWorkerScheduleTeacherRow,
} from "../features/schedules/workerScheduleEntry";

// Worker-specific schedule reads, distinct from the admin
// getScheduleAssignments()/getScheduleTeachers() in apiScheduleAssignments.ts/
// apiScheduleTeachers.ts (left entirely unchanged). Those embed the full
// `workers(*)` row (schedule_teachers) or `workers(id, name)` alongside
// other fields -- more than a self-service read view needs to transmit.
// These two functions carry an explicit projection with no `workers` embed
// at all: the requesting worker already knows who they are (identity comes
// from useCurrentIdentity, not an embedded row), so nothing about the
// worker themselves is requested here, only what the normalized schedule
// contract needs.
//
// `semesterId` is a filter, never an authorization input -- row-level
// security (see the schedule_assignments/schedule_teachers "Workers can
// read own..." policies) independently determines which rows a `worker`-
// role session can see, regardless of what semesterId is requested. No
// worker_id is ever supplied by the client to either query.

export async function getMyScheduleAssignments(
  semesterId: number
): Promise<RawWorkerScheduleAssignmentRow[]> {
  const { data, error } = await supabase
    .from("schedule_assignments")
    .select(
      "id, weekday, start_time, end_time, subjects(name), groups(letter, year_of_admission, degrees(code, name))"
    )
    .eq("semester_id", semesterId);

  if (error) {
    console.error(error);
    throw new Error("Tu horario no pudo cargarse");
  }

  return (data ?? []) as unknown as RawWorkerScheduleAssignmentRow[];
}

export async function getMyScheduleTeacherActivities(
  semesterId: number
): Promise<RawWorkerScheduleTeacherRow[]> {
  const { data, error } = await supabase
    .from("schedule_teachers")
    .select("id, weekday, start_time, end_time, activity")
    .eq("semester_id", semesterId);

  if (error) {
    console.error(error);
    throw new Error("Tu horario no pudo cargarse");
  }

  return (data ?? []) as unknown as RawWorkerScheduleTeacherRow[];
}
