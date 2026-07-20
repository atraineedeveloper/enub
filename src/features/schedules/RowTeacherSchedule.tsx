import type { ReactNode } from "react";
import styled from "styled-components";
import HourScheduleSubjectGroup from "./HourScheduleSubjectGroup";
import HourScheduleSubjectTeacher from "./HourScheduleTeacher";
import {
  ScheduleBlockRow,
  ScheduleDividerRow,
  ScheduleRecessRow,
  type ScheduleWeekday,
} from "./scheduleTableLayout";
import type { ScheduleAssignment } from "./useScheduleAssignments";
import type { ScheduleTeacher } from "./useScheduleTeachers";
import type { Worker } from "../workers/useWorkers";

// Visual treatment for the derived, institutional "Homenaje / Tutoría"
// reservation (Monday 07:00-08:50, only for a teacher whose computed
// totalHours === 40) -- distinct from both a real occupied-cell activity
// (ScheduleEntryContent) and the red invalid-data warning, and not
// color-only: the dashed border itself signals "reserved placeholder, not
// a real row" independent of the grey palette.
const ReservedSlotBadge = styled.p`
  font-weight: 600;
  color: var(--color-grey-700);
  background-color: var(--color-grey-100);
  border: 1px dashed var(--color-grey-300);
  border-radius: var(--border-radius-sm);
  padding: 0.4rem 0.6rem;
  margin: 0;
`;

interface DayCellContentProps {
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

// A cell's actual content -- no wrapping element of its own (ScheduleCell,
// the shared <td>, already provides that). Unchanged composition from
// before this migration: whatever `children` the row passes (the
// Monday-only reserved-slot badge), then the scholar-assignment content,
// then the teacher-activity content, in that order.
function DayCellContent({
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
}: DayCellContentProps) {
  return (
    <>
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
    </>
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
    <ScheduleBlockRow
      timeLabel={timeLabel}
      renderCell={(day: ScheduleWeekday, index: number) => (
        <DayCellContent
          schedulesScholar={schedulesScholar}
          scheduleTeacher={scheduleTeacher}
          weekday={day.value}
          startTime={startTime}
          workers={workers}
          semesterId={semesterId}
          workerId={workerId}
          workerLabel={workerLabel}
          allScheduleTeachers={allScheduleTeachers}
          allScheduleAssignments={allScheduleAssignments}
          isReservedSlot={index === 0 && mondayAddDisabled}
        >
          {index === 0 ? mondayExtra : null}
        </DayCellContent>
      )}
    />
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
  // The same condition the worker's read-only grid uses
  // (schoolDayBlocks.ts's getWorkerScheduleDayBlocks) to decide whether to
  // show the 17:00-19:00 row and its "HORARIO EXTRACURRICULAR" divider --
  // both surfaces check for a start_time of exactly 17:00:00, independent
  // of each other's data source.
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
      <ScheduleRecessRow timeLabel="8:50 - 9:20" />
      <TimeSlotRow {...shared} startTime="09:20:00" timeLabel="9:20 - 11:10" />
      <TimeSlotRow {...shared} startTime="11:10:00" timeLabel="11:10 - 13:00" />
      <ScheduleRecessRow timeLabel="13:00 - 13:10" />
      <TimeSlotRow {...shared} startTime="13:10:00" timeLabel="13:10 - 15:00" />
      {hasExtraHours && (
        <>
          <ScheduleDividerRow label="HORARIO EXTRACURRICULAR" />
          <TimeSlotRow {...shared} startTime="17:00:00" timeLabel="17:00 - 19:00" />
        </>
      )}
    </>
  );
}

export default RowTeacherSchedule;
