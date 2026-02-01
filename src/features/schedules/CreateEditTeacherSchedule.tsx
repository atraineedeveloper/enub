import { useForm } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import Select from "../../ui/Select";
import Textarea from "../../ui/Textarea";
import capitalizeName from "../../helpers/capitalizeFirstLetter";
import { useCreateScheduleTeacher } from "./useCreateScheduleTeacher";
import { useEditScheduleTeacher } from "./useEditScheduleTeacher";
import { WEEKDAYS, START_TIMES, END_TIMES } from "../../helpers/constants";
import type { Worker } from "../../types/entities";

interface TeacherScheduleForm {
  weekday: string;
  worker_id: number;
  activity: string;
  start_time: string;
  end_time: string;
}

interface Props {
  workers: Worker[];
  semesterId: string | undefined;
  onCloseModal?: () => void;
  scheduleToEdit?: Partial<TeacherScheduleForm & { id: number }>;
}

function CreateEditTeacherSchedule({
  workers,
  semesterId,
  onCloseModal,
  scheduleToEdit = {},
}: Props) {
  const { id: editId, ...editValues } = scheduleToEdit || {};
  const isEditSession = Boolean(editId);

  const { isCreating, createScheduleTeacher } = useCreateScheduleTeacher();
  const { isEditing, editScheduleTeacher } = useEditScheduleTeacher();

  const isWorking = isCreating || isEditing;

  const { register, handleSubmit, reset, formState } = useForm<TeacherScheduleForm>({
    defaultValues: isEditSession ? editValues : {},
  });
  const { errors } = formState;

  function onSubmit(data: TeacherScheduleForm) {
    if (isEditSession) {
      editScheduleTeacher(
        { newScheduleData: { ...data, semester_id: semesterId ? +semesterId : undefined }, id: editId },
        {
          onSuccess: () => {
            reset();
            onCloseModal?.();
          },
        }
      );
    } else {
      createScheduleTeacher(
        { ...data, semester_id: semesterId ? +semesterId : undefined },
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
      <FormRow label="Dia de la semana" error={errors?.weekday?.message}>
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
      <FormRow label="Maestro" error={errors?.worker_id?.message}>
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
      <FormRow label="Actividad" error={errors?.activity?.message}>
        <Textarea
          id="activity"
          disabled={isWorking}
          {...register("activity", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow
        label="Hora Inicio (Agregue por módulo de 2 horas, según corresponda)"
        error={errors?.start_time?.message}
      >
        <Select
          id="start_time"
          disabled={isWorking}
          {...register("start_time", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          {START_TIMES.map((time) => (
            <option key={time.value} value={time.value}>
              {time.label}
            </option>
          ))}
        </Select>
      </FormRow>
      <FormRow
        label="Hora Fin (Agregue por módulo de 2 horas, según corresponda)"
        error={errors?.end_time?.message}
      >
        <Select
          id="end_time"
          disabled={isWorking}
          {...register("end_time", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          {END_TIMES.map((time) => (
            <option key={time.value} value={time.value}>
              {time.label}
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
