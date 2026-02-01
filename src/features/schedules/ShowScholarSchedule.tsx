import styled from "styled-components";
import Spinner from "../../ui/Spinner";
import RowScholarSchedule from "./RowScholarSchedule";
import Select from "../../ui/Select";
import calculateSemesterGroup from "../../helpers/calculateSemesterGroup";
import { useState } from "react";
import ScheduleGroupPDF from "../../pdf/Schedules/ScheduleGroupPDF";
import type { ScheduleAssignment, Group } from "../../types/entities";

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

function ShowScholarSchedule({
  scheduleAssignments,
  groups,
  semesterId,
}: {
  scheduleAssignments: ScheduleAssignment[];
  groups: Group[];
  semesterId: string | undefined;
}) {
  const [filteredSchedules, setFilteredSchedules] = useState<ScheduleAssignment[]>([]);
  function selectingGroup(groupId: string) {
    const scheduleFilter = scheduleAssignments.filter((schedule) => {
      return schedule.group_id === +groupId;
    });
    setFilteredSchedules(scheduleFilter);
  }

  return (
    <>
      <Select id="group_id" onChange={(e) => selectingGroup(e.target.value)}>
        <option value="">Seleccione grupo escolar</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {calculateSemesterGroup(group.year_of_admission)}° "{group.letter}"
            - {group.degrees.code}
          </option>
        ))}
      </Select>
      <Table role="table">
        <TableHeader role="row">
          <div></div>
          <div>Lunes</div>
          <div>Martes</div>
          <div>Miércoles</div>
          <div>Jueves</div>
          <div>Viernes</div>
        </TableHeader>
        {filteredSchedules.length > 0 && (
          <RowScholarSchedule schedules={filteredSchedules} semesterId={semesterId} />
        )}
      </Table>
      {filteredSchedules.length > 0 && (
        <ScheduleGroupPDF schedules={filteredSchedules} />
      )}
    </>
  );
}

export default ShowScholarSchedule;
