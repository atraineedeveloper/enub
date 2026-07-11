import { useForm, type FieldValues } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import Select from "../../ui/Select";
import toast from "react-hot-toast";
import { useCallback, useContext, useEffect, useState } from "react";
import { calculateSemesterGroupForSemester } from "../../helpers/calculateSemesterGroup";
import type { Subject } from "../subjects/useSubjects";
import { useEditScheduleAssignment } from "./useEditScheduleAssignments";
import { useCreateScheduleAssignments } from "./useCreateScheduleAssignments";
import { SemesterContext } from "../../pages/SemesterContext";
import { hasWorkerConflict, hasGroupConflict } from "../../helpers/detectScheduleConflict";
import type { ScheduleAssignment } from "./useScheduleAssignments";

interface CreateEditScholarScheduleProps {
  semesterId?: string;
  scheduleToEdit?: Partial<ScheduleAssignment>;
  onCloseModal?: () => void;
}

function CreateEditScholarSchedule({
  semesterId,
  scheduleToEdit = {},
  onCloseModal,
}: CreateEditScholarScheduleProps) {
  const { isEditing, editScheduleAssignment } = useEditScheduleAssignment();
  const { createScheduleAssignments } = useCreateScheduleAssignments();

  const semesterData = useContext(SemesterContext);

  const { groups, workers, subjects, scheduleAssignments, semesterCode } =
    semesterData!;

  const { id: editId, ...editValues } = scheduleToEdit;
  const isEditSession = Boolean(editId);

  const [filteredSubjects, setFilteredSubjects] = useState<Subject[]>([]);

  const selectingGroup = useCallback(
    (value: string | number | null | undefined) => {
      const groupFound = groups.find((gp) => gp.id === +value!);

      const semesterFound = calculateSemesterGroupForSemester(
        groupFound!.year_of_admission,
        semesterCode
      );

      const subjectsFilterSemester = subjects.filter((subject) => {
        // Decision 4: preserve the existing loose-equality comparison exactly
        // -- `semester` is a nullable string column compared against
        // calculateSemesterGroup()'s numeric return, so both sides are
        // normalized to number here rather than switching to strict equality
        // (which would change behavior for numeric-string values like "3" vs 3).
        return Number(subject.semester) == semesterFound;
      });

      const subjectsFilterDegree = subjectsFilterSemester.filter((subject) => {
        return subject.degrees!.id === groupFound!.degrees!.id;
      });

      setFilteredSubjects(subjectsFilterDegree);
    },
    [groups, subjects, semesterCode]
  );

  useEffect(() => {
    if (isEditSession) {
      selectingGroup(editValues.group_id);
    }
  }, [isEditSession, editValues.group_id, selectingGroup]);

  const { register, handleSubmit, reset, formState } = useForm<FieldValues>({
    defaultValues: (isEditSession ? editValues : {}) as FieldValues,
  });
  const { errors } = formState;

  function onSubmit(data: FieldValues) {
    const resolvedSemesterId = Number(semesterId || editValues.semester_id);
    if (!resolvedSemesterId) {
      toast.error("No se pudo determinar el semestre del horario.");
      return;
    }

    data.semester_id = resolvedSemesterId;

    if (hasWorkerConflict(scheduleAssignments, data, editId)) {
      toast.error("El maestro ya tiene clase asignada ese día en ese horario.");
      return;
    }
    if (hasGroupConflict(scheduleAssignments, data, editId)) {
      toast.error("El grupo ya tiene una clase asignada ese día en ese horario.");
      return;
    }

    if (isEditSession) {
      delete data.groups;
      delete data.semesters;
      delete data.subjects;
      delete data.workers;
      editScheduleAssignment(
        { newScheduleAssignment: { ...data }, id: editId! },
        {
          onSuccess: () => {
            reset();
            onCloseModal?.();
          },
        }
      );
    } else
      createScheduleAssignments(
        { ...data },
        {
          onSuccess: () => {
            reset();
            onCloseModal?.();
          },
        }
      );
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label="Dia de la semana" error={errors?.weekday?.message as string | undefined}>
        <Select
          id="weekday"
          disabled={isEditing}
          {...register("weekday", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          <option value="Lunes">Lunes</option>
          <option value="Martes">Martes</option>
          <option value="Miercoles">Miercoles</option>
          <option value="Jueves">Jueves</option>
          <option value="Viernes">Viernes</option>
        </Select>
      </FormRow>
      <FormRow label="Grupo Escolar" error={errors?.group_id?.message as string | undefined}>
        <Select
          id="group_id"
          disabled={isEditing}
          {...register("group_id", {
            required: "Este campo es requerido",
          })}
          onChange={(e) => selectingGroup(e.target.value)}
        >
          <option value="">Seleccione...</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {calculateSemesterGroupForSemester(group.year_of_admission, semesterCode)}°{" "}
              &quot;{group.letter}&quot; - {group.degrees!.code}
            </option>
          ))}
        </Select>
      </FormRow>
      <FormRow label="Asignatura" error={errors?.subject_id?.message as string | undefined}>
        <Select
          id="subject_id"
          disabled={isEditing}
          {...register("subject_id", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          {filteredSubjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.semester}° - {subject.name} (
              {subject.study_programs!.year} - {subject.degrees!.code})
            </option>
          ))}
        </Select>
      </FormRow>
      <FormRow label="Hora de inicio" error={errors?.start_time?.message as string | undefined}>
        <Select
          id="start_time"
          disabled={isEditing}
          {...register("start_time", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          <option value="07:00:00">7:00</option>
          <option value="09:20:00">9:20</option>
          <option value="11:10:00">11:10</option>
          <option value="13:10:00">13:10</option>
        </Select>
      </FormRow>
      <FormRow label="Hora Fin" error={errors?.end_time?.message as string | undefined}>
        <Select
          id="end_time"
          disabled={isEditing}
          {...register("end_time", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          <option value="08:50:00">8:50</option>
          <option value="11:10:00">11:10</option>
          <option value="13:00:00">13:00</option>
          <option value="15:00:00">15:00</option>
        </Select>
      </FormRow>
      <FormRow label="Maestro" error={errors?.worker_id?.message as string | undefined}>
        <Select
          id="worker_id"
          disabled={isEditing}
          {...register("worker_id", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          {workers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.name}
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
        <Button>{isEditSession ? "Editar Horario" : "Añadir Horario"}</Button>
      </FormRow>
    </Form>
  );
}

export default CreateEditScholarSchedule;
