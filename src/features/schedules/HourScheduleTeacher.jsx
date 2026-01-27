import { FaTrash, FaPencilAlt } from "react-icons/fa";
import Modal from "../../ui/Modal";
import ConfirmDelete from "../../ui/ConfirmDelete";
import { useDeleteScheduleTeacher } from "./useDeleteScheduleTeacher";
import { useState } from "react";
import CreateEditTeacherSchedule from "./CreateEditTeacherSchedule";

function HourScheduleSubjectTeacher({ schedules, weekday, startTime, workers, semesterId }) {
  const [deleteModal, setDeleteModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const { isDeleting, deleteScheduleTeachers } = useDeleteScheduleTeacher();
  const activitiesHour = schedules.filter((schedule) => {
    return schedule.weekday === weekday && schedule.start_time === startTime;
  });

  if (activitiesHour.length > 0)
    return (
      <>
        {activitiesHour.map((activity) => (
          <div key={activity.id}>
            <b>{activity.activity}</b>
            <br />
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
              <Modal>
                <Modal.Open opens={`activity-schedule-edit-form-${activity.id}`}>
                   <FaPencilAlt style={{ cursor: "pointer", color: "var(--color-brand-600)" }} />
                </Modal.Open>
                <Modal.Window name={`activity-schedule-edit-form-${activity.id}`}>
                  <CreateEditTeacherSchedule
                    scheduleToEdit={activity}
                    workers={workers} // Necesitamos pasar workers y semesterId
                    semesterId={semesterId}
                    onCloseModal={() => setEditModal(false)}
                  />
                </Modal.Window>
              </Modal>

              <Modal>
                <Modal.Open opens={`activity-schedule-delete-form-${activity.id}`}>
                  <FaTrash style={{ cursor: "pointer", color: "var(--color-red-700)" }} />
                </Modal.Open>
                <Modal.Window name={`activity-schedule-delete-form-${activity.id}`}>
                  <ConfirmDelete
                    resourceName="actividad"
                    disabled={isDeleting}
                    onCloseModal={() => setDeleteModal(false)}
                    onConfirm={() => deleteScheduleTeachers(activity.id)}
                  />
                </Modal.Window>
              </Modal>
            </div>
          </div>
        ))}
      </>
    );

  return <p></p>;
}

export default HourScheduleSubjectTeacher;
