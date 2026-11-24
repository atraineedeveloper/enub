import type { ScheduleTeacher } from "../../features/schedules/useScheduleTeachers";

export default function filterHourActivity(schedules: ScheduleTeacher[], weekday: string, startTime: string) {
  return schedules.filter(schedule => schedule.weekday === weekday && schedule.start_time === startTime)
    .map(schedule => schedule.activity?.trim() || "Actividad sin nombre").join("\n\n");
}
