import { useQuery } from "@tanstack/react-query";
import { getSemesters } from "../../services/apiSemesters";
import type { Semester } from "./semesterTypes";
export type { Semester } from "./semesterTypes";

export function useSemesters() {
  const {
    isLoading,
    data: semesters,
    error,
  } = useQuery<Semester[]>({
    queryKey: ["semesters"],
    queryFn: getSemesters,
    staleTime: 5 * 60 * 1000,
  });

  return { isLoading, error, semesters };
}
