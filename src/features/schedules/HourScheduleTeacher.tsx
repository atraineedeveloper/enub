import { FaTrash, FaPencilAlt } from "react-icons/fa";
import Modal from "../../ui/Modal";
import ConfirmDelete from "../../ui/ConfirmDelete";
import { useDeleteScheduleTeacher } from "./useDeleteScheduleTeacher";
import CreateEditTeacherSchedule from "./CreateEditTeacherSchedule";
import type { ScheduleTeacher, Worker } from "../../types/entities";

interface Props {
  schedules: ScheduleTeacher[];
  weekday: string;
  startTime: string;
  workers: Worker[];
  semesterId: string | undefined;
}

const CreateEditTeacherScheduleAny = CreateEditTeacherSchedule as any;

function HourScheduleSubjectTeacher({
  schedules,
  weekday,
  startTime,
  workers,
  semesterId,
}: Props) {
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
                  <CreateEditTeacherScheduleAny
                    scheduleToEdit={activity}
                    workers={workers} // Necesitamos pasar workers y semesterId
                    semesterId={semesterId}
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
