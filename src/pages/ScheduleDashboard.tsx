import { createContext, useState, ComponentType } from "react";
import Button from "../ui/Button";
import Row from "../ui/Row";
import ScholarSchedule from "../features/schedules/ScholarSchedule";
import { useWorkers } from "../features/workers/useWorkers";
import Spinner from "../ui/Spinner";
import { useSubjects } from "../features/subjects/useSubjects";
import { useGroups } from "../features/groups/useGroups";
import { useParams } from "react-router-dom";
import { useScheduleAssignments } from "../features/schedules/useScheduleAssignments";
import calculateSemesterGroup from "../helpers/calculateSemesterGroup";
import TeacherSchedule from "../features/schedules/TeacherSchedule";
import { useScheduleTeachers } from "../features/schedules/useScheduleTeachers";
import WorkerSheetSemester from "../pdf/WorkerSheetSemester";
import { useSemesters } from "../features/semesters/useSemesters";
import Breadcrumbs, { BreadcrumbItem } from "../ui/Breadcrumbs";
import type { Group, ScheduleAssignment, ScheduleTeacher, Worker, Subject } from "../types/entities";

interface SemesterContextValue {
  groups: Group[];
  workers: Worker[];
  subjects: any[];
}

export const SemesterContext = createContext<SemesterContextValue | null>(null);
const WorkerSheetSemesterAny = WorkerSheetSemester as ComponentType<any>;

function ScheduleDashboard() {
  const { id } = useParams<{ id: string }>();
  const [showScholarSchedule, setShowScholarSchedule] = useState(false);
  const [showTeacherSchedule, setShowTeacherSchedule] = useState(false);

  const { isLoading: isLoadingWorkers, workers } = useWorkers({
    fullDetails: true,
  });
  const { isLoading: isLoadingSubjects, subjects } = useSubjects();
  const { isLoading: isLoadingGroups, groups } = useGroups();
  const { isLoading: isLoadingScheduleAssignments, scheduleAssignments } =
    useScheduleAssignments();
  const { isLoading: isLoadingScheduleTeachers, scheduleTeachers } =
    useScheduleTeachers();
  const { isLoading: isLoadingSemesters, semesters } = useSemesters();

  if (
    isLoadingWorkers ||
    isLoadingSubjects ||
    isLoadingGroups ||
    isLoadingScheduleAssignments ||
    isLoadingScheduleTeachers ||
    isLoadingSemesters
  )
    return <Spinner />;

  const currentGroups = (groups ?? []).filter((group) => {
    // if the group is below eight semester
    return calculateSemesterGroup(group.year_of_admission) <= 8;
  });

  const currentWorkers = (workers ?? []).filter((worker) => {
    // if worker is active
    return worker.status === 1;
  });

  const scheduleAssignmentsBySemester = (scheduleAssignments ?? []).filter(
    (schedule) => {
      return schedule.semester_id === +(id ?? 0);
    }
  );

  const scheduleTeachersBySemester = (scheduleTeachers ?? []).filter((schedule) => {
    return schedule.semester_id === +(id ?? 0);
  });

  const currentSemester = (semesters ?? []).filter((semester) => {
    return semester.id === +(id ?? 0);
  });

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Administrar horarios", to: "/semesters" },
    {
      label: `Semestre ${currentSemester[0]?.semester || ""}`,
    },
  ];

  return (
    <SemesterContext.Provider
      value={{ groups: currentGroups, workers: currentWorkers, subjects: subjects as Subject[] }}
    >
      <Breadcrumbs items={breadcrumbItems} />
      <Row>
        <Row>
          <Button onClick={() => setShowScholarSchedule(!showScholarSchedule)}>
            Gestionar horario escolar
          </Button>
          {showScholarSchedule && (
            <ScholarSchedule
              workers={workers ?? []}
              subjects={subjects ?? []}
              groups={currentGroups}
              semesterId={id}
              scheduleAssignments={scheduleAssignmentsBySemester}
            />
          )}
          <Button onClick={() => setShowTeacherSchedule(!showTeacherSchedule)}>
            Gestionar horario del maestro
          </Button>
          {showTeacherSchedule && (
            <TeacherSchedule
              workers={workers ?? []}
              semesterId={id}
              scheduleTeachers={scheduleTeachersBySemester}
              scheduleAssignments={scheduleAssignmentsBySemester}
            />
          )}
          <WorkerSheetSemesterAny
            semester={currentSemester}
            workers={workers}
            scheduleAssignments={scheduleAssignmentsBySemester}
            scheduleTeachers={scheduleTeachersBySemester}
          />
        </Row>
      </Row>
    </SemesterContext.Provider>
  );
}

export default ScheduleDashboard;
