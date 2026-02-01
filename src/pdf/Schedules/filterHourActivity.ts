function filterHourActivity(schedules: any[], weekday: string, startTime: string) {
  const activitytHour = schedules.filter((schedule) => {
    return schedule.weekday === weekday && schedule.start_time === startTime;
  });

  if (activitytHour.length > 0) {
    const textSchedule = `${activitytHour[0].activity}`;
    return textSchedule;
  }

  return ``;
}

export default filterHourActivity;
