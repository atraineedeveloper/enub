import capitalizeName from "../../helpers/capitalizeFirstLetter";
import type { ScheduleAssignment } from "../../features/schedules/useScheduleAssignments";

function filterHour(
  schedules: ScheduleAssignment[],
  weekday: string,
  startTime: string
) {
  const subjectHour = schedules.filter((schedule) => {
    return schedule.weekday === weekday && schedule.start_time === startTime;
  });

  if (subjectHour.length > 0) {
    const textSchedule = `${subjectHour[0].subjects!.name!.toUpperCase()}

${capitalizeName(subjectHour[0].workers!.name!)}`;
    return textSchedule;
  }

  return "--";
}

export default filterHour;
