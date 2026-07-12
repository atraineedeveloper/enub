import styled from "styled-components";
import RowScholarSchedule from "./RowScholarSchedule";
import Select from "../../ui/Select";
import { calculateSemesterGroupForSemester } from "../../helpers/calculateSemesterGroup";
import { useContext, useMemo, useState } from "react";
import ScheduleGroupPDF from "../../pdf/Schedules/ScheduleGroupPDF";
import { SemesterContext } from "../../pages/SemesterContext";
import type { ScheduleAssignment } from "./useScheduleAssignments";
import type { Group } from "../groups/useGroups";
import { isCanonicalBlock } from "./scheduleBlocks";

const Table = styled.div`
  border: 1px solid var(--color-grey-200);

  font-size: 1.4rem;
  background-color: var(--color-grey-0);
  border-radius: 7px;
  overflow: hidden;
`;

const TableHeader = styled.header`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
  column-gap: 2.4rem;
  align-items: center;

  background-color: var(--color-grey-50);
  border-bottom: 1px solid var(--color-grey-100);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-weight: 600;
  color: var(--color-grey-600);
  padding: 1.6rem 2.4rem;
`;

const InvalidSchedulesWarning = styled.div`
  color: var(--color-red-700);
  background-color: var(--color-red-100);
  padding: 1.2rem 1.6rem;
  border-radius: var(--border-radius-sm);
  margin-bottom: 1.6rem;

  p {
    font-weight: 600;
    margin-bottom: 0.4rem;
  }

  ul {
    margin: 0;
    padding-left: 2rem;
  }
`;

interface ShowScholarScheduleProps {
  scheduleAssignments: ScheduleAssignment[];
  groups: Group[];
  semesterId?: string;
}

function ShowScholarSchedule({
  scheduleAssignments,
  groups,
  semesterId,
}: ShowScholarScheduleProps) {
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const semesterData = useContext(SemesterContext);
  const semesterCode = semesterData?.semesterCode ?? null;

  const filteredSchedules = useMemo(() => {
    if (!selectedGroupId) return [];
    return scheduleAssignments.filter(
      (schedule) => schedule.group_id === +selectedGroupId
    );
  }, [scheduleAssignments, selectedGroupId]);

  const invalidSchedules = useMemo(
    () =>
      filteredSchedules.filter(
        (schedule) => !isCanonicalBlock(schedule.start_time, schedule.end_time)
      ),
    [filteredSchedules]
  );

  const selectedGroup = groups.find((group) => group.id === +selectedGroupId);
  const selectedGroupLabel = selectedGroup
    ? `${calculateSemesterGroupForSemester(
        selectedGroup.year_of_admission,
        semesterCode
      )}° "${selectedGroup.letter}" - ${selectedGroup.degrees!.code}`
    : "";

  return (
    <>
      <Select id="group_id" onChange={(e) => setSelectedGroupId(e.target.value)}>
        <option value="">Seleccione grupo escolar</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {calculateSemesterGroupForSemester(group.year_of_admission, semesterCode)}°{" "}
            &quot;{group.letter}&quot; - {group.degrees!.code}
          </option>
        ))}
      </Select>
      {invalidSchedules.length > 0 && (
        <InvalidSchedulesWarning role="alert">
          <p>
            Los siguientes horarios de este grupo tienen un intervalo que no
            corresponde a un bloque académico válido. Ábralos para
            corregirlos manualmente:
          </p>
          <ul>
            {invalidSchedules.map((schedule) => (
              <li key={schedule.id}>
                {schedule.weekday} —{" "}
                {schedule.subjects?.name ?? `horario #${schedule.id}`}
                {schedule.workers?.name ? ` (${schedule.workers.name})` : ""}:{" "}
                {schedule.start_time}–{schedule.end_time}
              </li>
            ))}
          </ul>
        </InvalidSchedulesWarning>
      )}
      <Table role="table">
        <TableHeader role="row">
          <div></div>
          <div>Lunes</div>
          <div>Martes</div>
          <div>Miércoles</div>
          <div>Jueves</div>
          <div>Viernes</div>
        </TableHeader>
        {selectedGroupId && (
          <RowScholarSchedule
            schedules={filteredSchedules}
            semesterId={semesterId}
            groupId={selectedGroupId}
            groupLabel={selectedGroupLabel}
          />
        )}
      </Table>
      {filteredSchedules.length > 0 && (
        <ScheduleGroupPDF schedules={filteredSchedules} />
      )}
    </>
  );
}

export default ShowScholarSchedule;
