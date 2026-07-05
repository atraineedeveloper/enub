import type { ReactNode } from "react";
import styled from "styled-components";
import HourScheduleSubjectGroup from "./HourScheduleSubjectGroup";
import HourScheduleSubjectTeacher from "./HourScheduleTeacher";
import type { ScheduleAssignment } from "./useScheduleAssignments";
import type { ScheduleTeacher } from "./useScheduleTeachers";
import type { Worker } from "../workers/useWorkers";

const TableRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
  column-gap: 2.4rem;
  align-items: center;
  padding: 1.4rem 2.4rem;
  text-align: center;

  &:not(:last-child) {
    border-bottom: 1px solid var(--color-grey-100);
  }
`;

const LongRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 6fr;
  column-gap: 2.4rem;
  align-items: center;
  padding: 1.4rem 2.4rem;
  text-align: center;
`;

const LongRowComplete = styled.div`
  display: grid;
  grid-template-columns: 7fr;
  column-gap: 2.4rem;
  align-items: center;
  padding: 1.4rem 2.4rem;
  text-align: center;
`;

const WEEKDAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"];

interface DayCellProps {
  schedulesScholar: ScheduleAssignment[];
  scheduleTeacher: ScheduleTeacher[];
  weekday: string;
  startTime: string;
  workers: Worker[];
  semesterId?: string;
  children?: ReactNode;
}

function DayCell({
  schedulesScholar,
  scheduleTeacher,
  weekday,
  startTime,
  workers,
  semesterId,
  children,
}: DayCellProps) {
  return (
    <div>
      {children}
      <HourScheduleSubjectGroup
        schedules={schedulesScholar}
        weekday={weekday}
        startTime={startTime}
      />
      <HourScheduleSubjectTeacher
        schedules={scheduleTeacher}
        weekday={weekday}
        startTime={startTime}
        workers={workers}
        semesterId={semesterId}
      />
    </div>
  );
}

interface TimeSlotRowProps {
  schedulesScholar: ScheduleAssignment[];
  scheduleTeacher: ScheduleTeacher[];
  workers: Worker[];
  semesterId?: string;
  startTime: string;
  timeLabel: string;
  mondayExtra?: ReactNode;
}

function TimeSlotRow({
  schedulesScholar,
  scheduleTeacher,
  workers,
  semesterId,
  startTime,
  timeLabel,
  mondayExtra = null,
}: TimeSlotRowProps) {
  return (
    <TableRow role="row">
      <p>{timeLabel}</p>
      {WEEKDAYS.map((weekday, i) => (
        <DayCell
          key={weekday}
          schedulesScholar={schedulesScholar}
          scheduleTeacher={scheduleTeacher}
          weekday={weekday}
          startTime={startTime}
          workers={workers}
          semesterId={semesterId}
        >
          {i === 0 ? mondayExtra : null}
        </DayCell>
      ))}
    </TableRow>
  );
}

function BreakRow({ timeLabel }: { timeLabel: string }) {
  return (
    <LongRow role="row">
      <p>{timeLabel}</p>
      <p>RECESO</p>
    </LongRow>
  );
}

interface RowTeacherScheduleProps {
  schedulesScholar: ScheduleAssignment[];
  scheduleTeacher: ScheduleTeacher[];
  totalHours: number;
  workers: Worker[];
  semesterId?: string;
}

function RowTeacherSchedule({
  schedulesScholar,
  scheduleTeacher,
  totalHours,
  workers,
  semesterId,
}: RowTeacherScheduleProps) {
  const hasExtraHours =
    schedulesScholar.some((s) => s.start_time === "17:00:00") ||
    scheduleTeacher.some((s) => s.start_time === "17:00:00");

  const mondayFirstBlock = (
    <p>{totalHours === 40 ? <b>Homenaje / Tutoria</b> : <b>--</b>}</p>
  );

  const shared = { schedulesScholar, scheduleTeacher, workers, semesterId };

  return (
    <>
      <TimeSlotRow
        {...shared}
        startTime="07:00:00"
        timeLabel="7:00 - 8:50"
        mondayExtra={mondayFirstBlock}
      />
      <BreakRow timeLabel="8:50 - 9:20" />
      <TimeSlotRow {...shared} startTime="09:20:00" timeLabel="9:20 - 11:10" />
      <TimeSlotRow {...shared} startTime="11:10:00" timeLabel="11:10 - 13:00" />
      <BreakRow timeLabel="13:00 - 13:10" />
      <TimeSlotRow {...shared} startTime="13:10:00" timeLabel="13:10 - 15:00" />
      {hasExtraHours && (
        <>
          <LongRowComplete role="row">
            <p>HORARIO EXTRACURRICULAR</p>
          </LongRowComplete>
          <TimeSlotRow
            {...shared}
            startTime="17:00:00"
            timeLabel="17:00 - 19:00"
          />
        </>
      )}
    </>
  );
}

export default RowTeacherSchedule;
