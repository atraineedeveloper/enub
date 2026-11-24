import { calculateSemesterGroupForSemester } from "../../helpers/calculateSemesterGroup";
import type { ScheduleAssignment } from "../../features/schedules/useScheduleAssignments";

export default function filterHourGroup(schedules: ScheduleAssignment[], weekday: string, startTime: string, semesterCode: string | null) {
  return schedules.filter(schedule => schedule.weekday === weekday && schedule.start_time === startTime).map(schedule => {
    const group = schedule.groups;
    const grade = group?.year_of_admission == null ? "—" : calculateSemesterGroupForSemester(group.year_of_admission, semesterCode);
    return `${schedule.subjects?.name?.toUpperCase() || "Asignatura no registrada"}\n\n  ${grade}° "${group?.letter ?? "—"}" - ${group?.degrees?.code ?? "—"}`;
  }).join("\n\n");
}
