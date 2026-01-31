import styled from "styled-components";
import Select from "../../ui/Select";
import { useState, useEffect, useMemo } from "react";
import RowTeacherSchedule from "./RowTeacherSchedule";
import ScheduleTeacherPDF from "../../pdf/Schedules/ScheduleTeacherPDF";
import capitalizeName from "../../helpers/capitalizeFirstLetter";

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
  text-align: center;

  background-color: var(--color-grey-50);
  border-bottom: 1px solid var(--color-grey-100);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-weight: 600;
  color: var(--color-grey-600);
  padding: 1.6rem 2.4rem;
`;

const groupData = (array, key) => {
  return array.reduce((result, currentValue) => {
    // Obtén el valor de la propiedad por la que vamos a agrupar
    const groupKey = currentValue[key];

    // Si el grupo aún no existe, créalo
    if (!result[groupKey]) {
      result[groupKey] = [];
    }

    // Agrega el elemento actual al grupo correspondiente
    result[groupKey].push(currentValue);

    return result;
  }, {});
};

function ShowTeacherSchedule({
  workers,
  scheduleTeachers,
  scheduleAssignments,
  semesterId,
}) {
  const [filteredSchedulesTeacher, setFilteredSchedulesTeacher] = useState([]);
  const [filteredSchedulesAssignments, setFilteredSchedulesAssignments] =
    useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);

  function selectingWorker(workerId) {
    setSelectedWorkerId(workerId ? +workerId : null);
    const scheduleTeacherFilter = scheduleTeachers.filter((schedule) => {
      return schedule.worker_id === +workerId;
    });

    const scheduleAssignmentsFilter = scheduleAssignments.filter((schedule) => {
      return schedule.worker_id === +workerId;
    });
    setFilteredSchedulesTeacher(scheduleTeacherFilter);
    setFilteredSchedulesAssignments(scheduleAssignmentsFilter);
  }

  const recordExist =
    filteredSchedulesTeacher.length > 0 ||
    filteredSchedulesAssignments.length > 0;

  // Re-aplicar filtros cuando cambian los datos cargados
  useEffect(() => {
    if (selectedWorkerId) selectingWorker(selectedWorkerId);
  }, [scheduleTeachers, scheduleAssignments, selectedWorkerId]);

  //******************* Extract Subjects *********************

  const groupedSubjects = useMemo(
    () => groupData(filteredSchedulesAssignments, "subject_id"),
    [filteredSchedulesAssignments]
  );

  // Extract Teacher Schedules

  const uniqueTeacherSchedule = useMemo(() => {
    const countTeacherSchedules = filteredSchedulesTeacher.reduce(
      (acc, item) => {
        const trimmedAcitivity = item.activity.trim();

        if (acc[trimmedAcitivity]) {
          acc[trimmedAcitivity]++;
        } else {
          acc[trimmedAcitivity] = 1;
        }
        return acc;
      },
      {}
    );

    return Object.keys(countTeacherSchedules).map((schedule) => {
      return {
        name: schedule,
        quantity: countTeacherSchedules[schedule],
      };
    });
  }, [filteredSchedulesTeacher]);

  // Sumar horas de asignaturas impartidas

  const totalHours = useMemo(() => {
    let total = 2;
    Object.keys(groupedSubjects).forEach(
      (subject) => (total += groupedSubjects[subject].length * 2)
    );

    uniqueTeacherSchedule.forEach(
      (schedule) => (total += schedule.quantity * 2)
    );
    return total;
  }, [groupedSubjects, uniqueTeacherSchedule]);

  console.log(totalHours);

  return (
    <>
      <Select id="worker_id" onChange={(e) => selectingWorker(e.target.value)}>
        <option value="">Seleccione trabajador</option>
        {workers.map((worker) => (
          <option key={worker.id} value={worker.id}>
            {capitalizeName(worker.name)}
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
        {recordExist && (
          <RowTeacherSchedule
            totalHours={totalHours}
            schedulesScholar={filteredSchedulesAssignments}
            scheduleTeacher={filteredSchedulesTeacher}
            workers={workers}
            semesterId={semesterId}
          />
        )}
      </Table>
      {recordExist && (
        <ScheduleTeacherPDF
          totalHours={totalHours}
          schedulesScholar={filteredSchedulesAssignments}
          scheduleTeacher={filteredSchedulesTeacher}
        />
      )}
    </>
  );
}

export default ShowTeacherSchedule;
