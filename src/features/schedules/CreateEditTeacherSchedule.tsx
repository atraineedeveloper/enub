import { useForm, type FieldValues } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import Select from "../../ui/Select";
import toast from "react-hot-toast";
import Textarea from "../../ui/Textarea";
import capitalizeName from "../../helpers/capitalizeFirstLetter";
import { useCreateScheduleTeacher } from "./useCreateScheduleTeacher";
import { useEditScheduleTeacher } from "./useEditScheduleTeacher";
import { WEEKDAYS } from "../../helpers/constants";
import { hasWorkerConflict } from "../../helpers/detectScheduleConflict";
import type { Worker } from "../workers/useWorkers";
import type { ScheduleTeacher } from "./useScheduleTeachers";
import type { ScheduleAssignment } from "./useScheduleAssignments";
import {
  TEACHER_SCHEDULE_BLOCKS,
  getTeacherBlockByStartTime,
  getTeacherBlockByTimes,
} from "./teacherScheduleBlocks";

interface TeacherScheduleInitialValues {
  weekday?: string;
  worker_id?: number;
  start_time?: string;
}

// Replicates ShowTeacherSchedule.tsx's totalHours formula exactly (base 2 +
// 2 per distinct schedule_assignments subject + 2 per distinct
// schedule_teachers activity), parameterized by worker instead of relying
// on that component's already-worker-filtered arrays. This lets onSubmit
// evaluate "is *this* worker at 40 hours" for whichever worker_id is
// actually submitted -- including a worker the admin switches to inside
// the form -- since `scheduleAssignments`/`scheduleTeachers` here are
// already the full, semester-level arrays (not filtered to any one
// worker), a direct consequence of the earlier conflict-detection fix.
// Not extracted into a shared helper: this file's own established
// precedent (see groupData duplication elsewhere in the schedules feature)
// is to keep small per-file computations like this local rather than
// consolidate them.
function calculateWorkerTotalHours(
  workerId: number,
  scheduleAssignments: ScheduleAssignment[],
  scheduleTeachers: ScheduleTeacher[]
): number {
  const workerAssignments = scheduleAssignments.filter(
    (schedule) => schedule.worker_id === workerId
  );
  const workerTeacherSchedules = scheduleTeachers.filter(
    (schedule) => schedule.worker_id === workerId
  );

  const groupedSubjects = workerAssignments.reduce(
    (result: Record<string, ScheduleAssignment[]>, item) => {
      const key = String(item.subject_id);
      if (!result[key]) result[key] = [];
      result[key].push(item);
      return result;
    },
    {}
  );

  const countTeacherSchedules = workerTeacherSchedules.reduce(
    (acc: Record<string, number>, item) => {
      const trimmedActivity = item.activity!.trim();
      acc[trimmedActivity] = (acc[trimmedActivity] ?? 0) + 1;
      return acc;
    },
    {}
  );

  let total = 2;
  Object.keys(groupedSubjects).forEach(
    (subject) => (total += groupedSubjects[subject].length * 2)
  );
  Object.keys(countTeacherSchedules).forEach(
    (activity) => (total += countTeacherSchedules[activity] * 2)
  );

  return total;
}

interface CreateEditTeacherScheduleProps {
  workers: Worker[];
  semesterId?: string;
  onCloseModal?: () => void;
  scheduleToEdit?: Partial<ScheduleTeacher>;
  scheduleTeachers?: ScheduleTeacher[];
  scheduleAssignments?: ScheduleAssignment[];
  initialValues?: TeacherScheduleInitialValues;
}

function CreateEditTeacherSchedule({
  workers,
  semesterId,
  onCloseModal,
  scheduleToEdit = {},
  scheduleTeachers = [],
  scheduleAssignments = [],
  initialValues,
}: CreateEditTeacherScheduleProps) {
  const { id: editId, ...editValues } = scheduleToEdit || {};
  const isEditSession = Boolean(editId);

  const { isCreating, createScheduleTeacher } = useCreateScheduleTeacher();
  const { isEditing, editScheduleTeacher } = useEditScheduleTeacher();

  const isWorking = isCreating || isEditing;

  // Unlike the scholar form's `subject_id` (whose options depend on an
  // async, group-filtered computation), every field here -- weekday,
  // worker_id, activity, and the block selector -- has a fully static,
  // synchronously-available option list, so plain defaultValues already
  // preloads all of them correctly; no setValue/useRef re-sync effect is
  // needed (design.md Decision 6).
  const editedBlock = isEditSession
    ? getTeacherBlockByTimes(editValues.start_time, editValues.end_time)
    : undefined;
  const isInvalidLegacyInterval = isEditSession && !editedBlock;

  const { register, handleSubmit, reset, formState } = useForm<FieldValues>({
    defaultValues: (isEditSession
      ? { ...editValues, start_time: editedBlock?.start_time ?? "" }
      : (initialValues ?? {})) as FieldValues,
  });
  const { errors } = formState;

  function onSubmit(data: FieldValues) {
    const block = getTeacherBlockByStartTime(data.start_time as string);
    if (!block) {
      toast.error("Bloque horario inválido.");
      return;
    }
    data.end_time = block.end_time;

    // Homenaje / Tutoría reservation: derived from the *submitted*
    // worker_id's own totalHours (not the teacher originally selected in
    // the table), so switching worker inside the form is still checked
    // correctly. Applies to every entry path -- free-cell Add, occupied-
    // cell edit, and the top-level manual form -- since they all funnel
    // through this same onSubmit.
    const isMondayFirstBlock =
      data.weekday === "Lunes" && data.start_time === "07:00:00";
    if (isMondayFirstBlock) {
      const workerTotalHours = calculateWorkerTotalHours(
        Number(data.worker_id),
        scheduleAssignments,
        scheduleTeachers
      );
      if (workerTotalHours === 40) {
        toast.error(
          "Lunes 7:00 - 8:50 está reservado para Homenaje / Tutoría de maestros con 40 horas asignadas; no se puede asignar una actividad en ese horario."
        );
        return;
      }
    }

    const allSchedules = [...scheduleTeachers, ...scheduleAssignments];
    if (hasWorkerConflict(allSchedules, data, editId)) {
      toast.error("El maestro ya tiene una actividad asignada ese día en ese horario.");
      return;
    }

    if (isEditSession) {
      editScheduleTeacher(
        { newScheduleData: { ...data, semester_id: semesterId }, id: editId! },
        {
          onSuccess: () => {
            reset();
            onCloseModal?.();
          },
        }
      );
    } else {
      createScheduleTeacher(
        { ...data, semester_id: semesterId },
        {
          onSuccess: () => {
            reset();
            onCloseModal?.();
          },
        }
      );
    }
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label="Dia de la semana" error={errors?.weekday?.message as string | undefined}>
        <Select
          id="weekday"
          disabled={isWorking}
          {...register("weekday", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          {WEEKDAYS.map((day) => (
            <option key={day.value} value={day.value}>
              {day.label}
            </option>
          ))}
        </Select>
      </FormRow>
      <FormRow label="Maestro" error={errors?.worker_id?.message as string | undefined}>
        <Select
          id="worker_id"
          disabled={isWorking}
          {...register("worker_id", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          {workers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {capitalizeName(worker.name)}
            </option>
          ))}
        </Select>
      </FormRow>
      <FormRow label="Actividad" error={errors?.activity?.message as string | undefined}>
        <Textarea
          id="activity"
          disabled={isWorking}
          {...register("activity", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      {isInvalidLegacyInterval && (
        <FormRow>
          <p role="alert">
            El intervalo actual ({editValues.start_time}–{editValues.end_time})
            no corresponde a un bloque válido. Seleccione el bloque correcto
            para continuar.
          </p>
        </FormRow>
      )}
      <FormRow label="Bloque horario" error={errors?.start_time?.message as string | undefined}>
        <Select
          id="start_time"
          disabled={isWorking}
          {...register("start_time", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          {TEACHER_SCHEDULE_BLOCKS.map((block) => (
            <option key={block.start_time} value={block.start_time}>
              {block.label}
            </option>
          ))}
        </Select>
      </FormRow>
      <FormRow>
        <Button
          variation="secondary"
          type="reset"
          onClick={() => onCloseModal?.()}
        >
          Cancelar
        </Button>
        <Button disabled={isWorking}>
          {isEditSession ? "Editar Actividad" : "Agregar Actividad"}
        </Button>
      </FormRow>
    </Form>
  );
}

export default CreateEditTeacherSchedule;
