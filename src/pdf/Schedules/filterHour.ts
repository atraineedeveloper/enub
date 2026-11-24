import capitalizeName from "../../helpers/capitalizeFirstLetter";
import type { ScheduleAssignment } from "../../features/schedules/useScheduleAssignments";

export default function filterHour(schedules: ScheduleAssignment[], weekday: string, startTime: string) {
  const matches = schedules.filter(schedule => schedule.weekday === weekday && schedule.start_time === startTime);
  return matches.map(schedule => `${schedule.subjects?.name?.toUpperCase() || "Asignatura no registrada"}\n\n${capitalizeName(schedule.workers?.name || "Docente no registrado")}`).join("\n\n") || "--";
}
