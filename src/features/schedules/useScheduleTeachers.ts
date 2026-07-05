import { useQuery } from "@tanstack/react-query";
import { getScheduleTeachers } from "../../services/apiScheduleTeachers";
import type { Database } from "../../types/supabase";
import type { Worker } from "../workers/useWorkers";
import type { Semester } from "../semesters/useSemesters";

// Matches apiScheduleTeachers.js's getScheduleTeachers() select:
// "*, workers(*), semesters(*)"
export type ScheduleTeacher =
  Database["public"]["Tables"]["schedule_teachers"]["Row"] & {
    workers: Worker | null;
    semesters: Semester | null;
  };

export function useScheduleTeachers() {
  const {
    isLoading,
    data: scheduleTeachers,
    error,
  } = useQuery<ScheduleTeacher[]>({
    queryKey: ["scheduleTeachers"],
    queryFn: getScheduleTeachers,
    staleTime: 30 * 1000,
  });

  return { isLoading, error, scheduleTeachers };
}
