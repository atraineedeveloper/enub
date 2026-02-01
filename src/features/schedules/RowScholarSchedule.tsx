import styled from "styled-components";
import HourScheduleSubject from "./HourScheduleSubject";
import type { ScheduleAssignment } from "../../types/entities";

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

function RowScholarSchedule({
  schedules,
  semesterId,
}: {
  schedules: ScheduleAssignment[];
  semesterId: string | number | undefined;
}) {
  return (
    <>
      <TableRow role="row">
        <p>7:00 - 8:50</p>
        <p>
          <b>Homenaje / Tutoria</b>
        </p>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Martes"
            startTime="07:00:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Miercoles"
            startTime="07:00:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Jueves"
            startTime="07:00:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Viernes"
            startTime="07:00:00"
            semesterId={semesterId}
          />
        </div>
      </TableRow>

      <LongRow role="row">
        <p>8:50 - 9:20</p>
        <p>RECESO</p>
      </LongRow>

      <TableRow role="row">
        <p>9:20 - 11:10</p>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Lunes"
            startTime="09:20:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Martes"
            startTime="09:20:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Miercoles"
            startTime="09:20:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Jueves"
            startTime="09:20:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Viernes"
            startTime="09:20:00"
            semesterId={semesterId}
          />
        </div>
      </TableRow>
      <TableRow role="row">
        <p>11:10 - 13:00</p>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Lunes"
            startTime="11:10:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Martes"
            startTime="11:10:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Miercoles"
            startTime="11:10:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Jueves"
            startTime="11:10:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Viernes"
            startTime="11:10:00"
            semesterId={semesterId}
          />
        </div>
      </TableRow>
      <LongRow role="row">
        <p>13:00 - 13:10</p>
        <p>RECESO</p>
      </LongRow>
      <TableRow role="row">
        <p>13:10 - 15:00</p>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Lunes"
            startTime="13:10:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Martes"
            startTime="13:10:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Miercoles"
            startTime="13:10:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Jueves"
            startTime="13:10:00"
            semesterId={semesterId}
          />
        </div>
        <div>
          <HourScheduleSubject
            schedules={schedules}
            weekday="Viernes"
            startTime="13:10:00"
            semesterId={semesterId}
          />
        </div>
      </TableRow>
    </>
  );
}

export default RowScholarSchedule;
