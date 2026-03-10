import { createContext, useState } from "react";
import styled from "styled-components";
import ScholarSchedule from "../features/schedules/ScholarSchedule";
import { useWorkers } from "../features/workers/useWorkers";
import Spinner from "../ui/Spinner";
import { useSubjects } from "../features/subjects/useSubjects";
import { useGroups } from "../features/groups/useGroups";
import { useParams } from "react-router-dom";
import { useScheduleAssignments } from "../features/schedules/useScheduleAssignments";
import calculateSemesterGroup from "../helpers/calculateSemesterGroup";
import sortWorkersBySurname from "../helpers/sortWorkersBySurname";
import TeacherSchedule from "../features/schedules/TeacherSchedule";
import { useScheduleTeachers } from "../features/schedules/useScheduleTeachers";
import WorkerSheetSemester from "../pdf/WorkerSheetSemester";
import { useSemesters } from "../features/semesters/useSemesters";
import Breadcrumbs from "../ui/Breadcrumbs";
import ErrorMessage from "../ui/ErrorMessage";
import Heading from "../ui/Heading";

export const SemesterContext = createContext(null);

const SemesterHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.6rem;
  margin-bottom: 2.4rem;
  flex-wrap: wrap;
`;

const SemesterMeta = styled.p`
  font-size: 1.4rem;
  color: var(--color-grey-500);
  margin-top: 0.2rem;
`;

const TabsBar = styled.div`
  display: flex;
  gap: 0.4rem;
  border-bottom: 2px solid var(--color-grey-200);
  margin-bottom: 2.4rem;
`;

const tabAccents = {
  scholar: "var(--color-gold-700)",
  teacher: "var(--color-gov-green-700)",
};

const Tab = styled.button`
  padding: 1rem 2rem;
  font-size: 1.5rem;
  font-weight: 600;
  border: none;
  background: none;
  cursor: pointer;
  color: ${(props) => (props.$active ? tabAccents[props.$tab] : "var(--color-grey-500)")};
  border-bottom: 2px solid ${(props) => (props.$active ? tabAccents[props.$tab] : "transparent")};
  margin-bottom: -2px;
  transition: color 0.2s ease, border-color 0.2s ease;

  &:hover {
    color: ${(props) => tabAccents[props.$tab]};
  }
`;

function ScheduleDashboard() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("scholar");

  const { isLoading: isLoadingWorkers, workers, error: errorWorkers } = useWorkers({ fullDetails: true });
  const { isLoading: isLoadingSubjects, subjects, error: errorSubjects } = useSubjects();
  const { isLoading: isLoadingGroups, groups, error: errorGroups } = useGroups();
  const { isLoading: isLoadingScheduleAssignments, scheduleAssignments, error: errorAssignments } = useScheduleAssignments();
  const { isLoading: isLoadingScheduleTeachers, scheduleTeachers, error: errorTeachers } = useScheduleTeachers();
  const { isLoading: isLoadingSemesters, semesters, error: errorSemesters } = useSemesters();

  if (
    isLoadingWorkers || isLoadingSubjects || isLoadingGroups ||
    isLoadingScheduleAssignments || isLoadingScheduleTeachers || isLoadingSemesters
  ) return <Spinner />;

  const anyError = errorWorkers || errorSubjects || errorGroups || errorAssignments || errorTeachers || errorSemesters;
  if (anyError) return <ErrorMessage message={anyError.message} />;

  const currentGroups = groups.filter((g) => calculateSemesterGroup(g.year_of_admission) <= 8);
  const currentWorkers = workers.filter((w) => w.status === 1);
  const sortedCurrentWorkers = sortWorkersBySurname(currentWorkers);
  const scheduleAssignmentsBySemester = scheduleAssignments.filter((s) => s.semester_id === +id);
  const scheduleTeachersBySemester = scheduleTeachers.filter((s) => s.semester_id === +id);
  const currentSemester = semesters.find((s) => s.id === +id);

  const breadcrumbItems = [
    { label: "Administrar horarios", to: "/semesters" },
    { label: `Semestre ${currentSemester?.semester || ""}` },
  ];

  return (
    <SemesterContext.Provider
      value={{
        groups: currentGroups,
        workers: sortedCurrentWorkers,
        subjects,
        scheduleAssignments: scheduleAssignmentsBySemester,
      }}
    >
      <Breadcrumbs items={breadcrumbItems} />

      <SemesterHeader>
        <div>
          <Heading as="h1">Semestre {currentSemester?.semester}</Heading>
          <SemesterMeta>Ciclo escolar {currentSemester?.school_year}</SemesterMeta>
        </div>
        <WorkerSheetSemester
          semester={currentSemester ? [currentSemester] : []}
          workers={sortedCurrentWorkers}
          scheduleAssignments={scheduleAssignmentsBySemester}
          scheduleTeachers={scheduleTeachersBySemester}
        />
      </SemesterHeader>

      <TabsBar>
        <Tab $active={activeTab === "scholar"} $tab="scholar" onClick={() => setActiveTab("scholar")}>
          Horario Escolar
        </Tab>
        <Tab $active={activeTab === "teacher"} $tab="teacher" onClick={() => setActiveTab("teacher")}>
          Horario del Maestro
        </Tab>
      </TabsBar>

      {activeTab === "scholar" && (
        <ScholarSchedule
          workers={sortedCurrentWorkers}
          subjects={subjects}
          groups={currentGroups}
          semesterId={id}
          scheduleAssignments={scheduleAssignmentsBySemester}
        />
      )}
      {activeTab === "teacher" && (
        <TeacherSchedule
          workers={sortedCurrentWorkers}
          semesterId={id}
          scheduleTeachers={scheduleTeachersBySemester}
          scheduleAssignments={scheduleAssignmentsBySemester}
        />
      )}
    </SemesterContext.Provider>
  );
}

export default ScheduleDashboard;
