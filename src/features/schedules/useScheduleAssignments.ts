import { useQuery } from "@tanstack/react-query";
import { getScheduleAssignments } from "../../services/apiScheduleAssignments";
import type { ScheduleAssignment } from "../../types/entities";

export function useScheduleAssignments() {
  const {
    isLoading,
    data: scheduleAssignments,
    error,
  } = useQuery({
    queryKey: ["scheduleAssignments"],
    queryFn: getScheduleAssignments,
  });

  return {
    isLoading,
    error,
    scheduleAssignments: scheduleAssignments as ScheduleAssignment[] | undefined,
  };
}
