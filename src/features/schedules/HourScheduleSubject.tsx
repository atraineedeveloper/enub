import { type ComponentType } from "react";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import Modal from "../../ui/Modal";
import ConfirmDelete from "../../ui/ConfirmDelete";
import { useDeleteScheduleAssignment } from "./useDeleteScheduleAssignment";
import capitalizeName from "../../helpers/capitalizeFirstLetter";
import UntypedCreateEditScholarSchedule from "./CreateEditScholarSchedule";
import {
  ScheduleActionButton as ActionButton,
  ScheduleActionsRow as ActionsRow,
} from "./ScheduleActionButton";
import { ScheduleEntryContent } from "./scheduleCellContent";
import type { ScheduleAssignment } from "./useScheduleAssignments";
import { getBlockByStartTime } from "./scheduleBlocks";

// CreateEditScholarSchedule.jsx is untyped and out of scope (Phase 3) --
// its `semesterId` param has no destructured default, so TS infers it as
// required, even though the component itself falls back to
// `editValues.semester_id` when editing and no semesterId is passed (which
// is exactly what happens at this call site). Local, type-only cast rather
// than converting the file.
const CreateEditScholarSchedule = UntypedCreateEditScholarSchedule as ComponentType<{
  semesterId?: string;
  scheduleToEdit?: ScheduleAssignment;
  initialValues?: {
    weekday?: string;
    group_id?: number;
    start_time?: string;
  };
  onCloseModal?: () => void;
}>;

interface HourScheduleSubjectProps {
  schedules: ScheduleAssignment[];
  weekday: string;
  startTime: string;
  semesterId?: string;
  groupId: string;
  groupLabel: string;
}

function HourScheduleSubject({
  schedules,
  weekday,
  startTime,
  semesterId,
  groupId,
  groupLabel,
}: HourScheduleSubjectProps) {
  const { isDeleting, deleteScheduleAssignment } =
    useDeleteScheduleAssignment();
  const subjectHour = schedules.filter((schedule) => {
    return schedule.weekday === weekday && schedule.start_time === startTime;
  });

  if (subjectHour.length > 0) {
    const subjectName = subjectHour[0].subjects!.name!;
    return (
      <ScheduleEntryContent
        kind="class"
        primaryText={subjectName}
        secondaryText={capitalizeName(subjectHour[0].workers!.name!)}
      >
        <ActionsRow>
          <Modal>
            <Modal.Open opens="scholar-schedule-edit-form">
              <ActionButton
                type="button"
                aria-label={`Editar horario: ${weekday} - ${subjectName}`}
                title="Editar horario"
              >
                <FaEdit />
              </ActionButton>
            </Modal.Open>
            <Modal.Window name="scholar-schedule-edit-form">
              <CreateEditScholarSchedule
                scheduleToEdit={subjectHour[0]}
              />
            </Modal.Window>
          </Modal>
          <Modal>
            <Modal.Open opens="scholar-schedule-delete-form">
              <ActionButton
                type="button"
                $variation="danger"
                aria-label={`Eliminar horario: ${weekday} - ${subjectName}`}
                title="Eliminar horario"
              >
                <FaTrash />
              </ActionButton>
            </Modal.Open>
            <Modal.Window name="scholar-schedule-delete-form">
              <ConfirmDelete
                resourceName="horario"
                disabled={isDeleting}
                onConfirm={() => deleteScheduleAssignment(subjectHour[0].id)}
              />
            </Modal.Window>
          </Modal>
        </ActionsRow>
      </ScheduleEntryContent>
    );
  }

  const blockLabel = getBlockByStartTime(startTime)?.label ?? startTime;
  const addLabel = groupLabel
    ? `Agregar horario: ${weekday} ${blockLabel} - ${groupLabel}`
    : `Agregar horario: ${weekday} ${blockLabel}`;

  return (
    <Modal>
      <Modal.Open opens="scholar-schedule-add-form">
        <ActionButton type="button" aria-label={addLabel} title="Agregar horario">
          <FaPlus />
        </ActionButton>
      </Modal.Open>
      <Modal.Window name="scholar-schedule-add-form">
        <CreateEditScholarSchedule
          semesterId={semesterId}
          initialValues={{
            weekday,
            group_id: Number(groupId),
            start_time: startTime,
          }}
        />
      </Modal.Window>
    </Modal>
  );
}

export default HourScheduleSubject;
