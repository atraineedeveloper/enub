import { useQuery } from "@tanstack/react-query";
import { getScheduleAssignments } from "../../services/apiScheduleAssignments";

export function useScheduleAssignments() {
  const {
    isLoading,
    data: scheduleAssignments,
    error,
  } = useQuery({
    queryKey: ["scheduleAssignments"],
    queryFn: getScheduleAssignments,
    staleTime: 30 * 1000,
  });

  return { isLoading, error, scheduleAssignments };
}
