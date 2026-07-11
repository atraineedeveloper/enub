import { calculateSemesterGroupForSemester } from "../../helpers/calculateSemesterGroup";
import type { ScheduleAssignment } from "../../features/schedules/useScheduleAssignments";

function filterHourGroup(
  schedules: ScheduleAssignment[],
  weekday: string,
  startTime: string,
  semesterCode: string | null
) {
  const subjectHour = schedules.filter((schedule) => {
    return schedule.weekday === weekday && schedule.start_time === startTime;
  });

  if (subjectHour.length > 0) {
    const textSchedule = `${subjectHour[0].subjects!.name!.toUpperCase()}

  ${calculateSemesterGroupForSemester(
    subjectHour[0].groups!.year_of_admission,
    semesterCode
  )}° "${
      subjectHour[0].groups!.letter
    }" - ${subjectHour[0].groups!.degrees!.code}`;
    return textSchedule;
  }

  return ``;
}

export default filterHourGroup;
