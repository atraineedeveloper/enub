import { FaEdit, FaTrash } from "react-icons/fa";
import Modal from "../../ui/Modal";
import ConfirmDelete from "../../ui/ConfirmDelete";
import { useDeleteScheduleAssignment } from "./useDeleteScheduleAssignment";
import capitalizeName from "../../helpers/capitalizeFirstLetter";
import CreateEditScholarSchedule from "./CreateEditScholarSchedule";
import type { ScheduleAssignment } from "../../types/entities";

interface HourScheduleSubjectProps {
  schedules: ScheduleAssignment[];
  weekday: string;
  startTime: string;
  semesterId: number | string | undefined;
}

const CreateEditScholarScheduleAny = CreateEditScholarSchedule as any;

function HourScheduleSubject({
  schedules,
  weekday,
  startTime,
  semesterId,
}: HourScheduleSubjectProps) {
  const { isDeleting, deleteScheduleAssignment } =
    useDeleteScheduleAssignment();
  const subjectHour = schedules.filter((schedule) => {
    return schedule.weekday === weekday && schedule.start_time === startTime;
  });

  if (!subjectHour.length) return <p>--</p>;

  const first = subjectHour[0]!;

  return (
    <>
      <b>{first.subjects?.name?.toUpperCase()}</b>
      <br />
      <em>{capitalizeName(first.workers?.name || "")}</em>
      <br />
      <Modal>
        <Modal.Open opens="scholar-schedule-edit-form">
          <FaEdit />
        </Modal.Open>
        <Modal.Window name="scholar-schedule-edit-form">
          <CreateEditScholarScheduleAny
            scheduleToEdit={first}
            semesterId={semesterId}
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
            onConfirm={() => deleteScheduleAssignment(first.id)}
          />
        </Modal.Window>
      </Modal>
    </>
  );
}

export default HourScheduleSubject;
