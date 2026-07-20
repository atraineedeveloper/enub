import { useEffect, useState } from "react";
import styled from "styled-components";
import Select from "../../ui/Select";
import Spinner from "../../ui/Spinner";
import ErrorMessage from "../../ui/ErrorMessage";
import Heading from "../../ui/Heading";
import { useSemesters, type Semester } from "../semesters/useSemesters";
import {
  resolveDefaultSemesterId,
  sortSemestersForSelector,
} from "../semesters/semesterOrdering";
import { formatSemesterPeriodWithCode } from "../semesters/semesterDisplayLabel";
import { useMyScheduleAssignments } from "./useMyScheduleAssignments";
import { useMyScheduleTeacherActivities } from "./useMyScheduleTeacherActivities";
import { entriesOutsideDesktopGrid, partitionWorkerSchedule } from "./workerScheduleEntry";
import { resolveMyScheduleViewState } from "./myScheduleViewState";
import WorkerScheduleGrid from "./WorkerScheduleGrid";
import WorkerScheduleAgenda from "./WorkerScheduleAgenda";
import WorkerScheduleUnspecified from "./WorkerScheduleUnspecified";

const SemesterHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.2rem;
  margin-bottom: 1.6rem;
`;

const EmptyStateMessage = styled.p`
  color: var(--color-grey-600);
  font-size: 1.6rem;
  text-align: center;
  margin: 4.8rem auto;
  max-width: 48rem;
`;

// Rendered above 900px -- the existing project mobile breakpoint, reused
// rather than a new one (design.md §8).
const DesktopOnly = styled.div`
  @media (max-width: 900px) {
    display: none;
  }
`;

const MobileOnly = styled.div`
  display: none;

  @media (max-width: 900px) {
    display: block;
  }
`;

// No workerId prop: unlike the profile page, the schedule queries carry
// no client-supplied worker filter at all (design.md §6) -- row-level
// security alone determines which rows come back, so there is nothing for
// this component to do with a worker id even though WorkerRouteGate
// resolves and validates one before rendering this page at all.
function MyScheduleView() {
  const { isLoading: isLoadingSemesters, semesters, error: semestersError } = useSemesters();
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);

  // Deterministic default selection, and reconciliation if the current
  // selection no longer exists in a refetched list (design.md "Semester
  // selection" / spec's "Selected semester no longer exists" scenario) --
  // explicitly not `semesters[0]`.
  useEffect(() => {
    if (!semesters) return;
    const stillExists = semesters.some((semester) => semester.id === selectedSemesterId);
    if (selectedSemesterId === null || !stillExists) {
      setSelectedSemesterId(resolveDefaultSemesterId(semesters));
    }
  }, [semesters, selectedSemesterId]);

  const {
    isLoading: isLoadingAssignments,
    scheduleAssignments,
    error: assignmentsError,
  } = useMyScheduleAssignments(selectedSemesterId ?? undefined);
  const {
    isLoading: isLoadingActivities,
    scheduleTeacherActivities,
    error: activitiesError,
  } = useMyScheduleTeacherActivities(selectedSemesterId ?? undefined);

  // Single source of truth for what renders (workerScheduleEntry's
  // normalization happens inside this resolver too) -- see
  // myScheduleViewState.ts. A partial failure of either schedule query, or
  // the semesters query, always yields "error", the same as a total
  // failure -- never partial content built from whichever query
  // succeeded.
  const state = resolveMyScheduleViewState({
    isLoadingSemesters,
    semestersError,
    semesters,
    selectedSemesterId,
    isLoadingAssignments,
    assignmentsError,
    scheduleAssignments,
    isLoadingActivities,
    activitiesError,
    scheduleTeacherActivities,
  });

  if (state.status === "loading") return <Spinner />;
  if (state.status === "error") {
    return <ErrorMessage message="Tu horario no pudo cargarse." />;
  }
  if (state.status === "no-semesters") {
    return (
      <EmptyStateMessage>Aún no hay semestres registrados.</EmptyStateMessage>
    );
  }

  // Reaching "empty-schedule" or "ready" guarantees semesters is a
  // non-empty array and selectedSemesterId is a real, currently-present id
  // (myScheduleViewState.ts's own preconditions for those two statuses).
  const currentSemesters = semesters as Semester[];
  const currentSelectedSemesterId = selectedSemesterId as number;

  if (state.status === "empty-schedule") {
    return (
      <>
        <SemesterSelect
          semesters={currentSemesters}
          selectedSemesterId={currentSelectedSemesterId}
          onChange={setSelectedSemesterId}
        />
        <EmptyStateMessage>
          No tienes actividades registradas para este semestre.
        </EmptyStateMessage>
      </>
    );
  }

  const partition = partitionWorkerSchedule(state.entries);
  const desktopUnspecified = entriesOutsideDesktopGrid(state.entries, partition);

  return (
    <div>
      <SemesterSelect
        semesters={currentSemesters}
        selectedSemesterId={currentSelectedSemesterId}
        onChange={setSelectedSemesterId}
      />

      <DesktopOnly>
        <WorkerScheduleGrid entries={partition.desktopPlaceable} />
        <WorkerScheduleUnspecified entries={desktopUnspecified} />
      </DesktopOnly>

      <MobileOnly>
        <WorkerScheduleAgenda entries={partition.mobilePlaceable} />
        <WorkerScheduleUnspecified entries={partition.unplaceable} />
      </MobileOnly>
    </div>
  );
}

interface SemesterSelectProps {
  semesters: Semester[];
  selectedSemesterId: number;
  onChange: (semesterId: number) => void;
}

function SemesterSelect({ semesters, selectedSemesterId, onChange }: SemesterSelectProps) {
  const ordered = sortSemestersForSelector(semesters);

  return (
    <SemesterHeader>
      <Heading as="h1">Mi horario</Heading>
      <Select
        aria-label="Seleccionar semestre"
        value={selectedSemesterId}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {ordered.map((semester) => (
          <option key={semester.id} value={semester.id}>
            {formatSemesterPeriodWithCode(semester.semester) ||
              `Semestre ${semester.id}`}
          </option>
        ))}
      </Select>
    </SemesterHeader>
  );
}

export default MyScheduleView;
