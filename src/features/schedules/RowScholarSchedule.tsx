import HourScheduleSubject from "./HourScheduleSubject";
import {
  ScheduleBlockRow,
  ScheduleRecessRow,
} from "./scheduleTableLayout";
import type { ScheduleAssignment } from "./useScheduleAssignments";

interface RowScholarScheduleProps {
  schedules: ScheduleAssignment[];
  semesterId?: string;
  groupId: string;
  groupLabel: string;
}

function RowScholarSchedule({
  schedules,
  semesterId,
  groupId,
  groupLabel,
}: RowScholarScheduleProps) {
  return (
    <>
      <ScheduleBlockRow
        timeLabel="7:00 - 8:50"
        renderCell={(day, index) =>
          // Monday's 07:00 cell is always the fixed institutional
          // "Homenaje / Tutoria" slot for every group -- never a lookup,
          // unlike every other cell in this row (unchanged from before
          // this migration).
          index === 0 ? (
            <b>Homenaje / Tutoria</b>
          ) : (
            <HourScheduleSubject
              schedules={schedules}
              weekday={day.value}
              startTime="07:00:00"
              semesterId={semesterId}
              groupId={groupId}
              groupLabel={groupLabel}
            />
          )
        }
      />

      <ScheduleRecessRow timeLabel="8:50 - 9:20" />

      <ScheduleBlockRow
        timeLabel="9:20 - 11:10"
        renderCell={(day) => (
          <HourScheduleSubject
            schedules={schedules}
            weekday={day.value}
            startTime="09:20:00"
            semesterId={semesterId}
            groupId={groupId}
            groupLabel={groupLabel}
          />
        )}
      />

      <ScheduleBlockRow
        timeLabel="11:10 - 13:00"
        renderCell={(day) => (
          <HourScheduleSubject
            schedules={schedules}
            weekday={day.value}
            startTime="11:10:00"
            semesterId={semesterId}
            groupId={groupId}
            groupLabel={groupLabel}
          />
        )}
      />

      <ScheduleRecessRow timeLabel="13:00 - 13:10" />

      <ScheduleBlockRow
        timeLabel="13:10 - 15:00"
        renderCell={(day) => (
          <HourScheduleSubject
            schedules={schedules}
            weekday={day.value}
            startTime="13:10:00"
            semesterId={semesterId}
            groupId={groupId}
            groupLabel={groupLabel}
          />
        )}
      />
    </>
  );
}

export default RowScholarSchedule;
