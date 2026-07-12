import styled from "styled-components";
import Button from "../../ui/Button";
import Row from "../../ui/Row";
import ShowScholarSchedule from "./ShowScholarSchedule";
import Modal from "../../ui/Modal";
import CreateEditScholarSchedule from "./CreateEditScholarSchedule";
import type { Worker } from "../workers/useWorkers";
import type { Subject } from "../subjects/useSubjects";
import type { Group } from "../groups/useGroups";
import type { ScheduleAssignment } from "./useScheduleAssignments";

const ActionsBar = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1.6rem;
`;

interface ScholarScheduleProps {
  workers: Worker[];
  // Optional, not just unused: ScheduleDashboard.tsx's own `subjects` value
  // is `Subject[] | undefined` at the JSX call site (asserted with `!` only
  // where it builds SemesterContext's value, not here) -- since this prop is
  // never read in this file, matching that real, possibly-undefined shape is
  // more accurate than requiring it and avoids touching the page file.
  subjects?: Subject[];
  groups: Group[];
  semesterId?: string;
  scheduleAssignments: ScheduleAssignment[];
}

// `workers`/`subjects` are kept in the props type (ScheduleDashboard.tsx's
// caller still passes them, unchanged) but deliberately not destructured
// below: CreateEditScholarSchedule reads them from SemesterContext, not
// props, so forwarding them into that call was always dead prop-threading
// (design.md's Real Bugs section). Removing the two dead JSX attributes is
// this phase's one explicitly authorized cleanup; not binding them to local
// names here avoids introducing new unused-variable lint noise.
function ScholarSchedule({
  groups,
  semesterId,
  scheduleAssignments,
}: ScholarScheduleProps) {
  return (
    <Row>
      <ActionsBar>
        <Modal>
          <Modal.Open opens="scholar-schedule-form">
            <Button>Agregar horario manualmente</Button>
          </Modal.Open>
          <Modal.Window name="scholar-schedule-form">
            <CreateEditScholarSchedule semesterId={semesterId} />
          </Modal.Window>
        </Modal>
      </ActionsBar>
      <ShowScholarSchedule
        scheduleAssignments={scheduleAssignments}
        groups={groups}
        semesterId={semesterId}
      />
    </Row>
  );
}

export default ScholarSchedule;
