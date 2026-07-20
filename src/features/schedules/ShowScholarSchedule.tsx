import styled from "styled-components";
import RowScholarSchedule from "./RowScholarSchedule";
import Select from "../../ui/Select";
import { calculateSemesterGroupForSemester } from "../../helpers/calculateSemesterGroup";
import { useContext, useMemo, useState } from "react";
import ScheduleGroupPDF from "../../pdf/Schedules/ScheduleGroupPDF";
import { SemesterContext } from "../../pages/SemesterContext";
import { ScheduleTable, ScheduleTableHeader } from "./scheduleTableLayout";
import type { ScheduleAssignment } from "./useScheduleAssignments";
import type { Group } from "../groups/useGroups";
import { isCanonicalBlock } from "./scheduleBlocks";

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
      <ScheduleTable caption={`Horario semanal${selectedGroupLabel ? ` del grupo ${selectedGroupLabel}` : ""}`}>
        <ScheduleTableHeader />
        <tbody>
          {selectedGroupId && (
            <RowScholarSchedule
              schedules={filteredSchedules}
              semesterId={semesterId}
              groupId={selectedGroupId}
              groupLabel={selectedGroupLabel}
            />
          )}
        </tbody>
      </ScheduleTable>
      {filteredSchedules.length > 0 && (
        <ScheduleGroupPDF schedules={filteredSchedules} />
      )}
    </>
  );
}

export default ShowScholarSchedule;
