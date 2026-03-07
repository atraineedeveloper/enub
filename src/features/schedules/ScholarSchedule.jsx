import styled from "styled-components";
import Button from "../../ui/Button";
import Row from "../../ui/Row";
import ShowScholarSchedule from "./ShowScholarSchedule";
import Modal from "../../ui/Modal";
import CreateEditScholarSchedule from "./CreateEditScholarSchedule";

const ActionsBar = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1.6rem;
`;

function ScholarSchedule({
  workers,
  subjects,
  groups,
  semesterId,
  scheduleAssignments,
}) {
  return (
    <Row>
      <ActionsBar>
        <Modal>
          <Modal.Open opens="scholar-schedule-form">
            <Button>+ Agregar horario escolar</Button>
          </Modal.Open>
          <Modal.Window name="scholar-schedule-form">
            <CreateEditScholarSchedule
              workers={workers}
              subjects={subjects}
              groups={groups}
              semesterId={semesterId}
            />
          </Modal.Window>
        </Modal>
      </ActionsBar>
      <ShowScholarSchedule
        scheduleAssignments={scheduleAssignments}
        groups={groups}
      />
    </Row>
  );
}

export default ScholarSchedule;
