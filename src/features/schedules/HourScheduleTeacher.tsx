import { FaTrash, FaPencilAlt, FaPlus } from "react-icons/fa";
import Modal from "../../ui/Modal";
import ConfirmDelete from "../../ui/ConfirmDelete";
import { useDeleteScheduleTeacher } from "./useDeleteScheduleTeacher";
import CreateEditTeacherSchedule from "./CreateEditTeacherSchedule";
import { getTeacherBlockByStartTime } from "./teacherScheduleBlocks";
import {
  ScheduleActionButton as ActionButton,
  ScheduleActionsRow as ActionsRow,
} from "./ScheduleActionButton";
import { ScheduleEntryContent } from "./scheduleCellContent";
import type { ScheduleTeacher } from "./useScheduleTeachers";
import type { ScheduleAssignment } from "./useScheduleAssignments";
import type { Worker } from "../workers/useWorkers";

interface ScheduleOverlapRow {
  weekday: string | null;
  start_time: string | null;
  end_time: string | null;
}

// UI-only early guard (design.md's "additional early guard, not a
// replacement for conflict validation" -- hasWorkerConflict in
// CreateEditTeacherSchedule.tsx remains the authoritative check at submit
// time). Uses the same strict-inequality overlap semantics as
// hasWorkerConflict/hasGroupConflict, not exact start_time equality, so an
// invalid/legacy row spanning multiple blocks still blocks Add in every
// block it actually covers, not only the one matching its own start_time.
function overlapsBlock(
  rows: ScheduleOverlapRow[],
  weekday: string,
  blockStartTime: string,
  blockEndTime: string
): boolean {
  return rows.some(
    (row) =>
      row.weekday === weekday &&
      row.start_time != null &&
      row.end_time != null &&
      blockStartTime < row.end_time &&
      row.start_time < blockEndTime
  );
}

interface HourScheduleSubjectTeacherProps {
  schedules: ScheduleTeacher[];
  // Selected-worker-filtered scholar assignments (the same array
  // HourScheduleSubjectGroup already renders in this cell) -- used only to
  // decide whether Add should be offered; that sibling component remains
  // the sole renderer of scholar-assignment content/controls.
  scholarAssignments: ScheduleAssignment[];
  weekday: string;
  startTime: string;
  workers: Worker[];
  semesterId?: string;
  workerId: string;
  workerLabel: string;
  // Full, semester-level (not selected-teacher-filtered) arrays -- passed
  // straight through to CreateEditTeacherSchedule so its hasWorkerConflict
  // check is correct for whichever worker ends up selected in the form,
  // not just the currently-selected teacher this cell belongs to.
  allScheduleTeachers: ScheduleTeacher[];
  allScheduleAssignments: ScheduleAssignment[];
  // True only for Monday 07:00-08:50 when this worker's totalHours === 40
  // (the derived "Homenaje / Tutoría" institutional reservation -- see
  // RowTeacherSchedule.tsx). Suppresses this cell's Add action as a UI
  // early guard; CreateEditTeacherSchedule.tsx's onSubmit is the
  // authoritative check that also covers the top-level manual form and
  // edit-into-this-slot.
  isReservedSlot?: boolean;
}

function HourScheduleSubjectTeacher({
  schedules,
  scholarAssignments,
  weekday,
  startTime,
  workers,
  semesterId,
  workerId,
  workerLabel,
  allScheduleTeachers,
  allScheduleAssignments,
  isReservedSlot = false,
}: HourScheduleSubjectTeacherProps) {
  const { isDeleting, deleteScheduleTeachers } = useDeleteScheduleTeacher();
  const activitiesHour = schedules.filter((schedule) => {
    return schedule.weekday === weekday && schedule.start_time === startTime;
  });

  if (activitiesHour.length > 0)
    return (
      <>
        {activitiesHour.map((activity) => (
          <ScheduleEntryContent
            key={activity.id}
            kind="activity"
            primaryText={activity.activity!}
          >
            <ActionsRow>
              <Modal>
                <Modal.Open opens={`activity-schedule-edit-form-${activity.id}`}>
                  <ActionButton
                    type="button"
                    aria-label={`Editar actividad: ${activity.weekday} - ${activity.activity}`}
                    title="Editar actividad"
                  >
                    <FaPencilAlt />
                  </ActionButton>
                </Modal.Open>
                <Modal.Window name={`activity-schedule-edit-form-${activity.id}`}>
                  <CreateEditTeacherSchedule
                    scheduleToEdit={activity}
                    workers={workers} // Necesitamos pasar workers y semesterId
                    semesterId={semesterId}
                    scheduleTeachers={allScheduleTeachers}
                    scheduleAssignments={allScheduleAssignments}
                  />
                </Modal.Window>
              </Modal>

              <Modal>
                <Modal.Open opens={`activity-schedule-delete-form-${activity.id}`}>
                  <ActionButton
                    type="button"
                    $variation="danger"
                    aria-label={`Eliminar actividad: ${activity.weekday} - ${activity.activity}`}
                    title="Eliminar actividad"
                  >
                    <FaTrash />
                  </ActionButton>
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
            </ActionsRow>
          </ScheduleEntryContent>
        ))}
      </>
    );

  const cellBlock = getTeacherBlockByStartTime(startTime);
  const isBlockedByTeacherActivity =
    cellBlock != null &&
    overlapsBlock(schedules, weekday, startTime, cellBlock.end_time);
  const isBlockedByScholarAssignment =
    cellBlock != null &&
    overlapsBlock(scholarAssignments, weekday, startTime, cellBlock.end_time);

  // A legacy/invalid teacher activity or a scholar assignment overlaps
  // this block without exactly starting here -- its own content already
  // renders in its own start_time cell (teacher activity) or via the
  // sibling HourScheduleSubjectGroup (scholar assignment); this cell just
  // suppresses Add rather than duplicating that content (no continuation
  // rendering). The reserved Monday slot suppresses Add for the same
  // reason: its own content (the ReservedSlotBadge) already renders as
  // this cell's `children`, one level up in RowTeacherSchedule.tsx.
  if (isBlockedByTeacherActivity || isBlockedByScholarAssignment || isReservedSlot)
    return <p></p>;

  const blockLabel = cellBlock?.label ?? startTime;
  const addLabel = workerLabel
    ? `Agregar actividad: ${weekday} ${blockLabel} - ${workerLabel}`
    : `Agregar actividad: ${weekday} ${blockLabel}`;

  return (
    <Modal>
      <Modal.Open opens={`activity-schedule-add-form-${weekday}-${startTime}`}>
        <ActionButton type="button" aria-label={addLabel} title="Agregar actividad">
          <FaPlus />
        </ActionButton>
      </Modal.Open>
      <Modal.Window name={`activity-schedule-add-form-${weekday}-${startTime}`}>
        <CreateEditTeacherSchedule
          workers={workers}
          semesterId={semesterId}
          scheduleTeachers={allScheduleTeachers}
          scheduleAssignments={allScheduleAssignments}
          initialValues={{
            weekday,
            worker_id: Number(workerId),
            start_time: startTime,
          }}
        />
      </Modal.Window>
    </Modal>
  );
}

export default HourScheduleSubjectTeacher;
