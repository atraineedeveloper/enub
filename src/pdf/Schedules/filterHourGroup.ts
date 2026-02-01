import calculateSemesterGroup from "../../helpers/calculateSemesterGroup";

function filterHourGroup(schedules: any[], weekday: string, startTime: string) {
  const subjectHour = schedules.filter((schedule) => {
    return schedule.weekday === weekday && schedule.start_time === startTime;
  });

  if (subjectHour.length > 0) {
    const textSchedule = `${subjectHour[0].subjects.name.toUpperCase()}
  
  ${calculateSemesterGroup(subjectHour[0].groups.year_of_admission)}° "${
      subjectHour[0].groups.letter
    }" - ${subjectHour[0].groups.degrees.code}`;
    return textSchedule;
  }

  return ``;
}

export default filterHourGroup;
