import { useState } from "react";
import { FaTrash, FaPencilAlt } from "react-icons/fa";
import Modal from "../../ui/Modal";
import ConfirmDelete from "../../ui/ConfirmDelete";
import { useDeleteScheduleTeacher } from "./useDeleteScheduleTeacher";
import CreateEditTeacherSchedule from "./CreateEditTeacherSchedule";
import type { ScheduleTeacher } from "./useScheduleTeachers";
import type { Worker } from "../workers/useWorkers";

interface HourScheduleSubjectTeacherProps {
  schedules: ScheduleTeacher[];
  weekday: string;
  startTime: string;
  workers: Worker[];
  semesterId?: string;
}

function HourScheduleSubjectTeacher({
  schedules,
  weekday,
  startTime,
  workers,
  semesterId,
}: HourScheduleSubjectTeacherProps) {
  const { isDeleting, deleteScheduleTeachers } = useDeleteScheduleTeacher();
  const activitiesHour = schedules.filter((schedule) => {
    return schedule.weekday === weekday && schedule.start_time === startTime;
  });

  // Authorized fix (design.md Decision 3): onCloseModal below already
  // referenced setEditModal without this file ever declaring it -- a live
  // no-undef ReferenceError when the edit modal closed. Adding the same
  // paired declaration its sibling components (HourScheduleSubject.jsx/
  // HourScheduleSubjectGroup.jsx) already use is the minimal, pattern-
  // consistent fix; no other modal behavior changes.
  const [editModal, setEditModal] = useState(false);

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
                    onConfirm={() =>
                      deleteScheduleTeachers(activity.id, {
                        onSuccess: () => {},
                      })
                    }
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
