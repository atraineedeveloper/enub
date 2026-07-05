import { useState, type ComponentType } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import Modal from "../../ui/Modal";
import ConfirmDelete from "../../ui/ConfirmDelete";
import { useDeleteScheduleAssignment } from "./useDeleteScheduleAssignment";
import capitalizeName from "../../helpers/capitalizeFirstLetter";
import UntypedCreateEditScholarSchedule from "./CreateEditScholarSchedule";
import type { ScheduleAssignment } from "./useScheduleAssignments";

// CreateEditScholarSchedule.jsx is untyped and out of scope (Phase 3) --
// its `semesterId` param has no destructured default, so TS infers it as
// required, even though the component itself falls back to
// `editValues.semester_id` when editing and no semesterId is passed (which
// is exactly what happens at this call site). Local, type-only cast rather
// than converting the file.
const CreateEditScholarSchedule = UntypedCreateEditScholarSchedule as ComponentType<{
  semesterId?: string;
  scheduleToEdit?: ScheduleAssignment;
  onCloseModal?: () => void;
}>;

interface HourScheduleSubjectProps {
  schedules: ScheduleAssignment[];
  weekday: string;
  startTime: string;
}

function HourScheduleSubject({
  schedules,
  weekday,
  startTime,
}: HourScheduleSubjectProps) {
  const { isDeleting, deleteScheduleAssignment } =
    useDeleteScheduleAssignment();
  const subjectHour = schedules.filter((schedule) => {
    return schedule.weekday === weekday && schedule.start_time === startTime;
  });

  const [editModal, setEditModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  if (subjectHour.length > 0)
    return (
      <>
        <b>{subjectHour[0].subjects!.name!.toUpperCase()}</b>
        <br />
        <em>{capitalizeName(subjectHour[0].workers!.name!)}</em>
        <br />
        <Modal>
          <Modal.Open opens="scholar-schedule-edit-form">
            <FaEdit />
          </Modal.Open>
          <Modal.Window name="scholar-schedule-edit-form">
            <CreateEditScholarSchedule
              scheduleToEdit={subjectHour[0]}
              onCloseModal={() => setEditModal(false)}
            />
          </Modal.Window>
        </Modal>
        &nbsp; &nbsp; &nbsp;
        <Modal>
          <Modal.Open opens="scholar-schedule-delete-form">
            <FaTrash />
          </Modal.Open>
          <Modal.Window name="scholar-schedule-delete-form">
            <ConfirmDelete
              resourceName="horario"
              disabled={isDeleting}
              onCloseModal={() => setDeleteModal(false)}
              onConfirm={() => deleteScheduleAssignment(subjectHour[0].id)}
            />
          </Modal.Window>
        </Modal>
      </>
    );

  return <p>--</p>;
}

export default HourScheduleSubject;
