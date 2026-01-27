import { FaEdit, FaTrash } from "react-icons/fa";
import Row from "../../ui/Row";
import calculateSemesterGroup from "../../helpers/calculateSemesterGroup";
import { useState } from "react";
import Modal from "../../ui/Modal";
import CreateScholarSchedule from "./EditScholarSchedule";
import ConfirmDelete from "../../ui/ConfirmDelete";
import { useDeleteScheduleAssignment } from "./useDeleteScheduleAssignment";
import CreateEditScholarSchedule from "./CreateEditScholarSchedule";

function HourScheduleSubjectGroup({ schedules, weekday, startTime }) {
  const { isDeleting, deleteScheduleAssignment } =
    useDeleteScheduleAssignment();
  const schedulesHour = schedules.filter((schedule) => {
    return schedule.weekday === weekday && schedule.start_time === startTime;
  });

  const [editModal, setEditModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  if (schedulesHour.length > 0)
    return (
      <>
        {schedulesHour.map((schedule) => (
          <div key={schedule.id}>
            <b>{schedule?.subjects.name.toUpperCase()}</b>
            <br />
            <em>
              {calculateSemesterGroup(schedule?.groups?.year_of_admission)}° "
              {schedule?.groups?.letter}" - {schedule?.groups?.degrees?.code}
            </em>
            <br />
            <Modal>
              <Modal.Open opens={`scholar-schedule-edit-form-${schedule.id}`}>
                <FaEdit />
              </Modal.Open>
              <Modal.Window name={`scholar-schedule-edit-form-${schedule.id}`}>
                <CreateEditScholarSchedule
                  scheduleToEdit={schedule}
                  onCloseModal={() => setEditModal(false)}
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
                  onCloseModal={() => setDeleteModal(false)}
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
