import { type ComponentType } from "react";
import styled from "styled-components";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import Modal from "../../ui/Modal";
import ConfirmDelete from "../../ui/ConfirmDelete";
import { useDeleteScheduleAssignment } from "./useDeleteScheduleAssignment";
import capitalizeName from "../../helpers/capitalizeFirstLetter";
import UntypedCreateEditScholarSchedule from "./CreateEditScholarSchedule";
import type { ScheduleAssignment } from "./useScheduleAssignments";
import { getBlockByStartTime } from "./scheduleBlocks";

const AddButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;

  & svg {
    width: 1.6rem;
    height: 1.6rem;
  }
`;

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
              onConfirm={() => deleteScheduleAssignment(subjectHour[0].id)}
            />
          </Modal.Window>
        </Modal>
      </>
    );

  const blockLabel = getBlockByStartTime(startTime)?.label ?? startTime;
  const addLabel = groupLabel
    ? `Agregar horario: ${weekday} ${blockLabel} - ${groupLabel}`
    : `Agregar horario: ${weekday} ${blockLabel}`;

  return (
    <Modal>
      <Modal.Open opens="scholar-schedule-add-form">
        <AddButton type="button" aria-label={addLabel}>
          <FaPlus />
        </AddButton>
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
