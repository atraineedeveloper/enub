import { useQuery } from "@tanstack/react-query";
import { getScheduleAssignments } from "../../services/apiScheduleAssignments";
import type { Database } from "../../types/supabase";
import type { Worker } from "../workers/useWorkers";
import type { Subject } from "../subjects/useSubjects";
import type { Group } from "../groups/useGroups";
import type { Degree } from "../degrees/useDegrees";
import type { Semester } from "../semesters/useSemesters";

// Matches apiScheduleAssignments.js's getScheduleAssignments() select:
// "*, workers(id, name), subjects(id, name),
//  groups(id, year_of_admission, letter, degrees(id, code, name)),
//  semesters(id, school_year)"
export type ScheduleAssignment =
  Database["public"]["Tables"]["schedule_assignments"]["Row"] & {
    workers: Pick<Worker, "id" | "name"> | null;
    subjects: Pick<Subject, "id" | "name"> | null;
    groups:
      | (Pick<Group, "id" | "year_of_admission" | "letter"> & {
          degrees: Pick<Degree, "id" | "code" | "name"> | null;
        })
      | null;
    semesters: Pick<Semester, "id" | "school_year"> | null;
  };

export function useScheduleAssignments(semesterId: number | undefined) {
  const isValidSemesterId =
    typeof semesterId === "number" && Number.isFinite(semesterId);

  const {
    isLoading,
    data: scheduleAssignments,
    error,
  } = useQuery<ScheduleAssignment[]>({
    queryKey: ["scheduleAssignments", semesterId],
    queryFn: () => getScheduleAssignments(semesterId as number),
    staleTime: 30 * 1000,
    enabled: isValidSemesterId,
  });

  return { isLoading, error, scheduleAssignments };
}
