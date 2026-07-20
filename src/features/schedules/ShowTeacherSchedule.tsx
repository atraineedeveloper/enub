import styled from "styled-components";
import Select from "../../ui/Select";
import { useCallback, useState, useEffect, useMemo } from "react";
import RowTeacherSchedule from "./RowTeacherSchedule";
import ScheduleTeacherPDF from "../../pdf/Schedules/ScheduleTeacherPDF";
import capitalizeName from "../../helpers/capitalizeFirstLetter";
import { isCanonicalTeacherBlock } from "./teacherScheduleBlocks";
import { ScheduleTable, ScheduleTableHeader } from "./scheduleTableLayout";
import type { ScheduleAssignment } from "./useScheduleAssignments";
import type { ScheduleTeacher } from "./useScheduleTeachers";
import type { Worker } from "../workers/useWorkers";

const InvalidActivitiesWarning = styled.div`
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

// Decision 5: kept independently typed in place, in every file that already
// had its own copy -- not consolidated into a shared helper.
const groupData = (array: ScheduleAssignment[], key: "subject_id") => {
  return array.reduce(
    (result: Record<string, ScheduleAssignment[]>, currentValue) => {
      // Obtén el valor de la propiedad por la que vamos a agrupar
      const groupKey = String(currentValue[key]);

      // Si el grupo aún no existe, créalo
      if (!result[groupKey]) {
        result[groupKey] = [];
      }

      // Agrega el elemento actual al grupo correspondiente
      result[groupKey].push(currentValue);

      return result;
    },
    {}
  );
};

interface ShowTeacherScheduleProps {
  workers: Worker[];
  scheduleTeachers: ScheduleTeacher[];
  scheduleAssignments: ScheduleAssignment[];
  semesterId?: string;
}

function ShowTeacherSchedule({
  workers,
  scheduleTeachers,
  scheduleAssignments,
  semesterId,
}: ShowTeacherScheduleProps) {
  const [filteredSchedulesTeacher, setFilteredSchedulesTeacher] = useState<
    ScheduleTeacher[]
  >([]);
  const [filteredSchedulesAssignments, setFilteredSchedulesAssignments] =
    useState<ScheduleAssignment[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(
    null
  );

  const selectingWorker = useCallback(
    (workerId: string | number) => {
      setSelectedWorkerId(workerId ? +workerId : null);
      const scheduleTeacherFilter = scheduleTeachers.filter((schedule) => {
        return schedule.worker_id === +workerId;
      });

      const scheduleAssignmentsFilter = scheduleAssignments.filter((schedule) => {
        return schedule.worker_id === +workerId;
      });
      setFilteredSchedulesTeacher(scheduleTeacherFilter);
      setFilteredSchedulesAssignments(scheduleAssignmentsFilter);
    },
    [scheduleTeachers, scheduleAssignments]
  );

  const recordExist =
    filteredSchedulesTeacher.length > 0 ||
    filteredSchedulesAssignments.length > 0;

  const workerId = selectedWorkerId != null ? String(selectedWorkerId) : "";
  const selectedWorker = workers.find((worker) => worker.id === selectedWorkerId);
  const workerLabel = selectedWorker ? capitalizeName(selectedWorker.name) : "";

  const invalidActivities = useMemo(
    () =>
      filteredSchedulesTeacher.filter(
        (schedule) => !isCanonicalTeacherBlock(schedule.start_time, schedule.end_time)
      ),
    [filteredSchedulesTeacher]
  );

  // Re-aplicar filtros cuando cambian los datos cargados
  useEffect(() => {
    if (selectedWorkerId) selectingWorker(selectedWorkerId);
  }, [selectedWorkerId, selectingWorker]);

  //******************* Extract Subjects *********************

  const groupedSubjects = useMemo(
    () => groupData(filteredSchedulesAssignments, "subject_id"),
    [filteredSchedulesAssignments]
  );

  // Extract Teacher Schedules

  const uniqueTeacherSchedule = useMemo(() => {
    const countTeacherSchedules = filteredSchedulesTeacher.reduce(
      (acc: Record<string, number>, item) => {
        const trimmedAcitivity = item.activity!.trim();

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
      {invalidActivities.length > 0 && (
        <InvalidActivitiesWarning role="alert">
          <p>
            Las siguientes actividades de este maestro tienen un intervalo
            que no corresponde a un bloque académico válido. Ábralas para
            corregirlas manualmente:
          </p>
          <ul>
            {invalidActivities.map((activity) => (
              <li key={activity.id}>
                {activity.weekday} — {activity.activity}:{" "}
                {activity.start_time}–{activity.end_time}
              </li>
            ))}
          </ul>
        </InvalidActivitiesWarning>
      )}
      <ScheduleTable caption={`Horario semanal${workerLabel ? ` del maestro ${workerLabel}` : ""}`}>
        <ScheduleTableHeader />
        <tbody>
          {selectedWorkerId !== null && (
            <RowTeacherSchedule
              totalHours={totalHours}
              schedulesScholar={filteredSchedulesAssignments}
              scheduleTeacher={filteredSchedulesTeacher}
              workers={workers}
              semesterId={semesterId}
              workerId={workerId}
              workerLabel={workerLabel}
              allScheduleTeachers={scheduleTeachers}
              allScheduleAssignments={scheduleAssignments}
            />
          )}
        </tbody>
      </ScheduleTable>
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
