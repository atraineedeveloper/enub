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

// Visual treatment for the derived, institutional "Homenaje / Tutoría"
// reservation (Monday 07:00-08:50, only for a teacher whose computed
// totalHours === 40) -- distinct from both a real occupied-cell activity
// (solid border, ActionButton controls) and the red invalid-data warning,
// and not color-only: the dashed border itself signals "reserved
// placeholder, not a real row" independent of the grey palette.
const ReservedSlotBadge = styled.p`
  font-weight: 600;
  color: var(--color-grey-700);
  background-color: var(--color-grey-100);
  border: 1px dashed var(--color-grey-300);
  border-radius: var(--border-radius-sm);
  padding: 0.4rem 0.6rem;
  margin: 0;
`;

const WEEKDAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"];

interface DayCellProps {
  schedulesScholar: ScheduleAssignment[];
  scheduleTeacher: ScheduleTeacher[];
  weekday: string;
  startTime: string;
  workers: Worker[];
  semesterId?: string;
  workerId: string;
  workerLabel: string;
  allScheduleTeachers: ScheduleTeacher[];
  allScheduleAssignments: ScheduleAssignment[];
  // True only for the Monday 07:00-08:50 cell when this worker's
  // totalHours === 40 -- a derived institutional reservation, not a real
  // schedule_teachers row; suppresses that one cell's Add action.
  isReservedSlot?: boolean;
  children?: ReactNode;
}

function DayCell({
  schedulesScholar,
  scheduleTeacher,
  weekday,
  startTime,
  workers,
  semesterId,
  workerId,
  workerLabel,
  allScheduleTeachers,
  allScheduleAssignments,
  isReservedSlot = false,
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
        scholarAssignments={schedulesScholar}
        weekday={weekday}
        startTime={startTime}
        workers={workers}
        semesterId={semesterId}
        workerId={workerId}
        workerLabel={workerLabel}
        allScheduleTeachers={allScheduleTeachers}
        allScheduleAssignments={allScheduleAssignments}
        isReservedSlot={isReservedSlot}
      />
    </div>
  );
}

interface TimeSlotRowProps {
  schedulesScholar: ScheduleAssignment[];
  scheduleTeacher: ScheduleTeacher[];
  workers: Worker[];
  semesterId?: string;
  workerId: string;
  workerLabel: string;
  allScheduleTeachers: ScheduleTeacher[];
  allScheduleAssignments: ScheduleAssignment[];
  startTime: string;
  timeLabel: string;
  mondayExtra?: ReactNode;
  // Only meaningful for the Monday column (weekday index 0) of whichever
  // TimeSlotRow this is -- callers other than the 07:00-08:50 row simply
  // don't pass it, defaulting to false.
  mondayAddDisabled?: boolean;
}

function TimeSlotRow({
  schedulesScholar,
  scheduleTeacher,
  workers,
  semesterId,
  workerId,
  workerLabel,
  allScheduleTeachers,
  allScheduleAssignments,
  startTime,
  timeLabel,
  mondayExtra = null,
  mondayAddDisabled = false,
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
          workerId={workerId}
          workerLabel={workerLabel}
          allScheduleTeachers={allScheduleTeachers}
          allScheduleAssignments={allScheduleAssignments}
          isReservedSlot={i === 0 && mondayAddDisabled}
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
  workerId: string;
  workerLabel: string;
  allScheduleTeachers: ScheduleTeacher[];
  allScheduleAssignments: ScheduleAssignment[];
}

function RowTeacherSchedule({
  schedulesScholar,
  scheduleTeacher,
  totalHours,
  workers,
  semesterId,
  workerId,
  workerLabel,
  allScheduleTeachers,
  allScheduleAssignments,
}: RowTeacherScheduleProps) {
  const hasExtraHours =
    schedulesScholar.some((s) => s.start_time === "17:00:00") ||
    scheduleTeacher.some((s) => s.start_time === "17:00:00");

  // Derived, institutional reservation -- not a schedule_teachers row, not
  // counted separately, and never created/updated/deleted in the database.
  // Triggered purely by this worker's already-computed totalHours; when it
  // isn't exactly 40, this cell shows nothing at all (no more "--").
  const isHomenajeTutoriaReserved = totalHours === 40;

  const mondayFirstBlock = isHomenajeTutoriaReserved ? (
    <ReservedSlotBadge>Homenaje / Tutoría</ReservedSlotBadge>
  ) : null;

  const shared = {
    schedulesScholar,
    scheduleTeacher,
    workers,
    semesterId,
    workerId,
    workerLabel,
    allScheduleTeachers,
    allScheduleAssignments,
  };

  return (
    <>
      <TimeSlotRow
        {...shared}
        startTime="07:00:00"
        timeLabel="7:00 - 8:50"
        mondayExtra={mondayFirstBlock}
        mondayAddDisabled={isHomenajeTutoriaReserved}
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
