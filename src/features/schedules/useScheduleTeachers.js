import { useQuery } from "@tanstack/react-query";
import { getScheduleTeachers } from "../../services/apiScheduleTeachers";

export function useScheduleTeachers() {
  const {
    isLoading,
    data: scheduleTeachers,
    error,
  } = useQuery({
    queryKey: ["scheduleTeachers"],
    queryFn: getScheduleTeachers,
    staleTime: 30 * 1000,
  });

  return { isLoading, error, scheduleTeachers };
}
