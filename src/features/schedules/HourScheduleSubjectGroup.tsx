import { FaEdit, FaTrash } from "react-icons/fa";
import { calculateSemesterGroupForSemester } from "../../helpers/calculateSemesterGroup";
import { useContext, type ComponentType } from "react";
import Modal from "../../ui/Modal";
import ConfirmDelete from "../../ui/ConfirmDelete";
import { useDeleteScheduleAssignment } from "./useDeleteScheduleAssignment";
import UntypedCreateEditScholarSchedule from "./CreateEditScholarSchedule";
import { SemesterContext } from "../../pages/SemesterContext";
import {
  ScheduleActionButton as ActionButton,
  ScheduleActionsRow as ActionsRow,
} from "./ScheduleActionButton";
import type { ScheduleAssignment } from "./useScheduleAssignments";

// CreateEditScholarSchedule.jsx is untyped and out of scope (Phase 3) -- see
// HourScheduleSubject.tsx for the full explanation of why `semesterId` needs
// this cast.
const CreateEditScholarSchedule = UntypedCreateEditScholarSchedule as ComponentType<{
  semesterId?: string;
  scheduleToEdit?: ScheduleAssignment;
  onCloseModal?: () => void;
}>;

interface HourScheduleSubjectGroupProps {
  schedules: ScheduleAssignment[];
  weekday: string;
  startTime: string;
}

function HourScheduleSubjectGroup({
  schedules,
  weekday,
  startTime,
}: HourScheduleSubjectGroupProps) {
  const { isDeleting, deleteScheduleAssignment } =
    useDeleteScheduleAssignment();
  const semesterData = useContext(SemesterContext);
  const semesterCode = semesterData?.semesterCode ?? null;
  const schedulesHour = schedules.filter((schedule) => {
    return schedule.weekday === weekday && schedule.start_time === startTime;
  });

  if (schedulesHour.length > 0)
    return (
      <>
        {schedulesHour.map((schedule) => (
          <div key={schedule.id}>
            <b>{schedule?.subjects!.name!.toUpperCase()}</b>
            <br />
            <em>
              {calculateSemesterGroupForSemester(schedule?.groups?.year_of_admission, semesterCode)}° &quot;
              {schedule?.groups?.letter}&quot; - {schedule?.groups?.degrees?.code}
            </em>
            <br />
            <ActionsRow>
              <Modal>
                <Modal.Open opens={`scholar-schedule-edit-form-${schedule.id}`}>
                  <ActionButton
                    type="button"
                    aria-label="Editar horario"
                    title="Editar horario"
                  >
                    <FaEdit />
                  </ActionButton>
                </Modal.Open>
                <Modal.Window name={`scholar-schedule-edit-form-${schedule.id}`}>
                  <CreateEditScholarSchedule
                    scheduleToEdit={schedule}
                  />
                </Modal.Window>
              </Modal>
              <Modal>
                <Modal.Open opens={`scholar-schedule-delete-form-${schedule.id}`}>
                  <ActionButton
                    type="button"
                    $variation="danger"
                    aria-label="Eliminar horario"
                    title="Eliminar horario"
                  >
                    <FaTrash />
                  </ActionButton>
                </Modal.Open>
                <Modal.Window name={`scholar-schedule-delete-form-${schedule.id}`}>
                  <ConfirmDelete
                    resourceName="horario"
                    disabled={isDeleting}
                    onConfirm={() => deleteScheduleAssignment(schedule.id)}
                  />
                </Modal.Window>
              </Modal>
            </ActionsRow>
          </div>
        ))}
      </>
    );

  return <p></p>;
}

export default HourScheduleSubjectGroup;
