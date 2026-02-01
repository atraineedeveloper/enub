import { FaEdit, FaTrash } from "react-icons/fa";
import calculateSemesterGroup from "../../helpers/calculateSemesterGroup";
import Modal from "../../ui/Modal";
import ConfirmDelete from "../../ui/ConfirmDelete";
import { useDeleteScheduleAssignment } from "./useDeleteScheduleAssignment";
import CreateEditScholarSchedule from "./CreateEditScholarSchedule";
import type { ScheduleAssignment } from "../../types/entities";

interface Props {
  schedules: ScheduleAssignment[];
  weekday: string;
  startTime: string;
  semesterId?: number | string;
}

const CreateEditScholarScheduleAny = CreateEditScholarSchedule as any;

function HourScheduleSubjectGroup({ schedules, weekday, startTime, semesterId }: Props) {
  const { isDeleting, deleteScheduleAssignment } =
    useDeleteScheduleAssignment();
  const schedulesHour = schedules.filter((schedule) => {
    return schedule.weekday === weekday && schedule.start_time === startTime;
  });
  if (schedulesHour.length > 0)
    return (
      <>
        {schedulesHour.map((schedule) => (
          <div key={schedule.id}>
            <b>{schedule?.subjects?.name?.toUpperCase()}</b>
            <br />
            <em>
              {calculateSemesterGroup(schedule?.groups?.year_of_admission || 0)}° "
              {schedule?.groups?.letter}" - {schedule?.groups?.degrees?.code}
            </em>
            <br />
            <Modal>
              <Modal.Open opens={`scholar-schedule-edit-form-${schedule.id}`}>
                <FaEdit />
              </Modal.Open>
              <Modal.Window name={`scholar-schedule-edit-form-${schedule.id}`}>
                <CreateEditScholarScheduleAny
                  scheduleToEdit={schedule}
                  semesterId={semesterId}
                />
              </Modal.Window>
            </Modal>
            &nbsp; &nbsp; &nbsp;
            <Modal>
              <Modal.Open opens={`scholar-schedule-delete-form-${schedule.id}`}>
                <FaTrash />
              </Modal.Open>
              <Modal.Window name={`scholar-schedule-delete-form-${schedule.id}`}>
                <ConfirmDelete
                  resourceName="horario"
                  disabled={isDeleting}
                  onConfirm={() => deleteScheduleAssignment(schedule.id)}
                />
              </Modal.Window>
            </Modal>
          </div>
        ))}
      </>
    );

  return <p></p>;
}

export default HourScheduleSubjectGroup;
