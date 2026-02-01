import capitalizeName from "../../helpers/capitalizeFirstLetter";

function filterHour(schedules: any[], weekday: string, startTime: string) {
  const subjectHour = schedules.filter((schedule) => {
    return schedule.weekday === weekday && schedule.start_time === startTime;
  });

  if (subjectHour.length > 0) {
    const textSchedule = `${subjectHour[0].subjects.name.toUpperCase()}

${capitalizeName(subjectHour[0].workers.name)}`;
    return textSchedule;
  }

  return "--";
}

export default filterHour;
