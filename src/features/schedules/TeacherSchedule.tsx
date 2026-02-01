import { useState } from "react";
import Row from "../../ui/Row";
import Button from "../../ui/Button";
import CreateEditTeacherSchedule from "./CreateEditTeacherSchedule";
import ShowTeacherSchedule from "./ShowTeacherSchedule";
import TeacherAssignment from "./TeacherAssignment";
import Modal from "../../ui/Modal";
import type { Worker, ScheduleTeacher, ScheduleAssignment } from "../../types/entities";

const CreateEditTeacherScheduleAny = CreateEditTeacherSchedule as any;

interface TeacherScheduleProps {
  workers: Worker[];
  scheduleTeachers: ScheduleTeacher[];
  scheduleAssignments: ScheduleAssignment[];
  semesterId: string | undefined;
}

function TeacherSchedule({
  workers,
  scheduleTeachers,
  scheduleAssignments,
  semesterId,
}: TeacherScheduleProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [showScheduleTeacher, setShowScheduleTeacher] = useState(false);
  const [showAssignmentTeacher, setShowAssignmentTeacher] = useState(false);

  return (
    <Row>
      <Modal>
        <Modal.Open opens="teacher-schedule-form">
          <Button variation="secondary">
            Agregar horario de actividades del maestro
          </Button>
        </Modal.Open>
        <Modal.Window name="teacher-schedule-form">
          <CreateEditTeacherScheduleAny
            workers={workers}
            semesterId={semesterId}
            onCloseModal={() => setShowCreate(false)}
          />
        </Modal.Window>
      </Modal>
      <Button
        variation="secondary"
        onClick={() => setShowScheduleTeacher((show) => !show)}
      >
        Ver horarios del maestro
      </Button>
      {showScheduleTeacher && (
        <ShowTeacherSchedule
          workers={workers}
          scheduleTeachers={scheduleTeachers}
          scheduleAssignments={scheduleAssignments}
          semesterId={semesterId}
        />
      )}
      <Button
        variation="secondary"
        onClick={() => setShowAssignmentTeacher((show) => !show)}
      >
        Ver asignación horaria
      </Button>
      {showAssignmentTeacher && (
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
