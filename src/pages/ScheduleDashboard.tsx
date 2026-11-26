import { useMemo, useState } from "react";
import styled from "styled-components";
import ScholarSchedule from "../features/schedules/ScholarSchedule";
import { useWorkers } from "../features/workers/useWorkers";
import Spinner from "../ui/Spinner";
import { useSubjects } from "../features/subjects/useSubjects";
import { useGroups } from "../features/groups/useGroups";
import { useParams } from "react-router-dom";
import { SemesterContext } from "./SemesterContext";
import { useScheduleAssignments } from "../features/schedules/useScheduleAssignments";
import { calculateSemesterGroupForSemester } from "../helpers/calculateSemesterGroup";
import sortWorkersBySurname from "../helpers/sortWorkersBySurname";
import TeacherSchedule from "../features/schedules/TeacherSchedule";
import { useScheduleTeachers } from "../features/schedules/useScheduleTeachers";
import WorkerSheetSemester from "../pdf/WorkerSheetSemester";
import { useSemesters } from "../features/semesters/useSemesters";
import Breadcrumbs from "../ui/Breadcrumbs";
import ErrorMessage from "../ui/ErrorMessage";
import Heading from "../ui/Heading";

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

const tabAccents: Record<string, string> = {
  scholar: "var(--color-gold-700)",
  teacher: "var(--color-gov-green-700)",
};

const Tab = styled.button<{ $active: boolean; $tab: string }>`
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
  const semesterId = id !== undefined ? Number(id) : undefined;
  const isValidSemesterId =
    typeof semesterId === "number" && Number.isFinite(semesterId);
  const [activeTab, setActiveTab] = useState("scholar");

  const { isLoading: isLoadingWorkers, workers, error: errorWorkers } = useWorkers({ fullDetails: true });
  const { isLoading: isLoadingSubjects, subjects, error: errorSubjects } = useSubjects();
  const { isLoading: isLoadingGroups, groups, error: errorGroups } = useGroups();
  const { isLoading: isLoadingScheduleAssignments, scheduleAssignments, error: errorAssignments } = useScheduleAssignments(semesterId);
  const { isLoading: isLoadingScheduleTeachers, scheduleTeachers, error: errorTeachers } = useScheduleTeachers(semesterId);
  const { isLoading: isLoadingSemesters, semesters, error: errorSemesters } = useSemesters();

  const currentSemester = semesters?.find((s) => s.id === semesterId);
  // Keep group selectors in academic order, independent of insertion order in Supabase.
  // Make a copy before sorting; React Query's cached groups must not be mutated.
  const currentGroups = useMemo(() => (groups ?? [])
    .filter((g) => {
      const grade = calculateSemesterGroupForSemester(
        g.year_of_admission,
        currentSemester?.semester
      );
      return (grade >= 1 && grade <= 8) || (scheduleAssignments ?? []).some(a => a.group_id === g.id);
    })
    .sort((a, b) => {
      const gradeA = calculateSemesterGroupForSemester(
        a.year_of_admission,
        currentSemester?.semester
      );
      const gradeB = calculateSemesterGroupForSemester(
        b.year_of_admission,
        currentSemester?.semester
      );
      return (
        gradeA - gradeB ||
        (a.degrees?.code ?? "").localeCompare(b.degrees?.code ?? "", "es") ||
        (a.letter ?? "").localeCompare(b.letter ?? "", "es") ||
        a.id - b.id
      );
    }), [groups, currentSemester?.semester, scheduleAssignments]);
  const sortedCurrentWorkers = useMemo(() => sortWorkersBySurname((workers ?? []).filter((w) => w.status === 1)), [workers]);

  if (!isValidSemesterId) {
    return <ErrorMessage message="El semestre solicitado no es válido." />;
  }

  const anyError = errorWorkers || errorSubjects || errorGroups || errorAssignments || errorTeachers || errorSemesters;

  if (
    !anyError && (
      isLoadingWorkers || isLoadingSubjects || isLoadingGroups ||
      isLoadingScheduleAssignments || isLoadingScheduleTeachers || isLoadingSemesters ||
      !scheduleAssignments || !scheduleTeachers
    )
  ) return <Spinner />;

  if (anyError) return <ErrorMessage message={anyError.message} />;

  const breadcrumbItems = [
    { label: "Administrar horarios", to: "/semesters" },
    { label: `Semestre ${currentSemester?.semester || ""}` },
  ];

  return (
    <SemesterContext.Provider
      value={{
        groups: currentGroups,
        workers: sortedCurrentWorkers,
        subjects: subjects!,
        scheduleAssignments: scheduleAssignments!,
        scheduleTeachers: scheduleTeachers!,
        semesterCode: currentSemester?.semester ?? null,
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
          scheduleAssignments={scheduleAssignments}
          scheduleTeachers={scheduleTeachers}
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
          scheduleAssignments={scheduleAssignments!}
        />
      )}
      {activeTab === "teacher" && (
        <TeacherSchedule
          workers={sortedCurrentWorkers}
          semesterId={id}
          scheduleTeachers={scheduleTeachers!}
          scheduleAssignments={scheduleAssignments!}
        />
      )}
    </SemesterContext.Provider>
  );
}

export default ScheduleDashboard;
