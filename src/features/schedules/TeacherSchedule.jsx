import { useState } from "react";
import styled from "styled-components";
import Row from "../../ui/Row";
import Button from "../../ui/Button";
import CreateEditTeacherSchedule from "./CreateEditTeacherSchedule";
import ShowTeacherSchedule from "./ShowTeacherSchedule";
import TeacherAssignment from "./TeacherAssignment";
import Modal from "../../ui/Modal";

const ActionsBar = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1.6rem;
`;

const SubTabsBar = styled.div`
  display: flex;
  gap: 0.4rem;
  border-bottom: 2px solid var(--color-grey-200);
  margin-bottom: 2rem;
`;

const SubTab = styled.button`
  padding: 0.8rem 1.6rem;
  font-size: 1.4rem;
  font-weight: 600;
  border: none;
  background: none;
  cursor: pointer;
  color: ${(props) => (props.$active ? "var(--color-brand-600)" : "var(--color-grey-500)")};
  border-bottom: 2px solid ${(props) => (props.$active ? "var(--color-brand-600)" : "transparent")};
  margin-bottom: -2px;
  transition: color 0.2s ease, border-color 0.2s ease;

  &:hover {
    color: var(--color-brand-600);
  }
`;

function TeacherSchedule({
  workers,
  scheduleTeachers,
  scheduleAssignments,
  semesterId,
}) {
  const [activeSubTab, setActiveSubTab] = useState("schedules");

  return (
    <Row>
      <ActionsBar>
        <Modal>
          <Modal.Open opens="teacher-schedule-form">
            <Button>+ Agregar horario de actividades</Button>
          </Modal.Open>
          <Modal.Window name="teacher-schedule-form">
            <CreateEditTeacherSchedule
              workers={workers}
              semesterId={semesterId}
              scheduleTeachers={scheduleTeachers}
              scheduleAssignments={scheduleAssignments}
            />
          </Modal.Window>
        </Modal>
      </ActionsBar>

      <SubTabsBar>
        <SubTab $active={activeSubTab === "schedules"} onClick={() => setActiveSubTab("schedules")}>
          Horarios del maestro
        </SubTab>
        <SubTab $active={activeSubTab === "assignment"} onClick={() => setActiveSubTab("assignment")}>
          Asignación horaria
        </SubTab>
      </SubTabsBar>

      {activeSubTab === "schedules" && (
        <ShowTeacherSchedule
          workers={workers}
          scheduleTeachers={scheduleTeachers}
          scheduleAssignments={scheduleAssignments}
          semesterId={semesterId}
        />
      )}
      {activeSubTab === "assignment" && (
        <TeacherAssignment
          workers={workers}
          scheduleTeachers={scheduleTeachers}
          scheduleAssignments={scheduleAssignments}
        />
      )}
    </Row>
  );
}

export default TeacherSchedule;
