import { useState } from "react";
import Button from "../../ui/Button";
import Row from "../../ui/Row";
import ShowScholarSchedule from "./ShowScholarSchedule";
import Modal from "../../ui/Modal";
import CreateEditScholarSchedule from "./CreateEditScholarSchedule";
import type { Worker, Subject, Group, ScheduleAssignment } from "../../types/entities";

interface ScholarScheduleProps {
  workers: Worker[];
  subjects: Subject[];
  groups: Group[];
  semesterId: string | undefined;
  scheduleAssignments: ScheduleAssignment[];
}

const CreateEditScholarScheduleAny = CreateEditScholarSchedule as any;

function ScholarSchedule({
  workers,
  subjects,
  groups,
  semesterId,
  scheduleAssignments,
}: ScholarScheduleProps) {
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showScheduleGroup, setShowScheduleGroup] = useState(false);

  return (
    <Row>
      <Modal>
        <Modal.Open opens="scholar-schedule-form">
          <Button variation="secondary">Agregar horario escolar</Button>
        </Modal.Open>
        <Modal.Window name="scholar-schedule-form">
          <CreateEditScholarScheduleAny
            workers={workers}
            subjects={subjects}
            groups={groups}
            semesterId={semesterId}
            onCloseModal={() => setShowAddSchedule(false)}
          />
        </Modal.Window>
      </Modal>
      <Button
        variation="secondary"
        onClick={() => setShowScheduleGroup((show) => !show)}
      >
        Ver horarios del grupo
      </Button>
      {showScheduleGroup && (
        <ShowScholarSchedule
          scheduleAssignments={scheduleAssignments}
          groups={groups}
          semesterId={semesterId}
        />
      )}
    </Row>
  );
}

export default ScholarSchedule;
