import { useQuery } from "@tanstack/react-query";
import { getScheduleTeachers } from "../../services/apiScheduleTeachers";
import type { ScheduleTeacher } from "../../types/entities";

export function useScheduleTeachers() {
  const {
    isLoading,
    data: scheduleTeachers,
    error,
  } = useQuery({
    queryKey: ["scheduleTeachers"],
    queryFn: getScheduleTeachers,
  });

  return {
    isLoading,
    error,
    scheduleTeachers: scheduleTeachers as ScheduleTeacher[] | undefined,
  };
}
