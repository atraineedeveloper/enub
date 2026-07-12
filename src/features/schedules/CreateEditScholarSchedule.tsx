import { useForm, type FieldValues } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import Select from "../../ui/Select";
import toast from "react-hot-toast";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { calculateSemesterGroupForSemester } from "../../helpers/calculateSemesterGroup";
import type { Subject } from "../subjects/useSubjects";
import { useEditScheduleAssignment } from "./useEditScheduleAssignments";
import { useCreateScheduleAssignments } from "./useCreateScheduleAssignments";
import { SemesterContext } from "../../pages/SemesterContext";
import { hasWorkerConflict, hasGroupConflict } from "../../helpers/detectScheduleConflict";
import type { ScheduleAssignment } from "./useScheduleAssignments";
import {
  SCHEDULE_BLOCKS,
  getBlockByStartTime,
  getBlockByTimes,
} from "./scheduleBlocks";

interface ScholarScheduleInitialValues {
  weekday?: string;
  group_id?: number;
  start_time?: string;
}

interface CreateEditScholarScheduleProps {
  semesterId?: string;
  scheduleToEdit?: Partial<ScheduleAssignment>;
  initialValues?: ScholarScheduleInitialValues;
  onCloseModal?: () => void;
}

function CreateEditScholarSchedule({
  semesterId,
  scheduleToEdit = {},
  initialValues,
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

  // Pure computation, extracted from the original selectingGroup so the
  // group <select>'s onChange handler can also use it to synchronously
  // decide whether the currently-selected subject is still valid for a
  // newly-chosen group -- setFilteredSubjects() alone can't answer that
  // synchronously since state updates are async.
  const computeFilteredSubjects = useCallback(
    (value: string | number | null | undefined): Subject[] => {
      const groupFound = groups.find((gp) => gp.id === +value!);
      if (!groupFound) return [];

      const semesterFound = calculateSemesterGroupForSemester(
        groupFound.year_of_admission,
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

      return subjectsFilterSemester.filter((subject) => {
        return subject.degrees!.id === groupFound.degrees!.id;
      });
    },
    [groups, subjects, semesterCode]
  );

  const selectingGroup = useCallback(
    (value: string | number | null | undefined) => {
      setFilteredSubjects(computeFilteredSubjects(value));
    },
    [computeFilteredSubjects]
  );

  useEffect(() => {
    if (isEditSession) {
      selectingGroup(editValues.group_id);
    } else if (initialValues?.group_id) {
      selectingGroup(initialValues.group_id);
    }
  }, [isEditSession, editValues.group_id, initialValues?.group_id, selectingGroup]);

  const editedBlock = isEditSession
    ? getBlockByTimes(editValues.start_time, editValues.end_time)
    : undefined;
  const isInvalidLegacyInterval = isEditSession && !editedBlock;

  const { register, handleSubmit, reset, formState, getValues, setValue } =
    useForm<FieldValues>({
      defaultValues: (isEditSession
        ? { ...editValues, start_time: editedBlock?.start_time ?? "" }
        : (initialValues ?? {})) as FieldValues,
    });
  const { errors } = formState;

  // Root cause: react-hook-form applies `defaultValues.subject_id` to the
  // <select> only once, when the ref mounts -- but at that point
  // filteredSubjects is still [] (selectingGroup's setState above hasn't
  // flushed yet), so the matching <option> doesn't exist and the browser
  // can't select it. Once filteredSubjects updates and the correct option
  // appears, nothing re-applies the value to the now-uncontrolled <select>.
  // Fix: explicitly re-set it with setValue() the first time the matching
  // option becomes available. Guarded by a ref so this only ever fires once
  // per mount -- it must not fight a later, deliberate group change that
  // happens to bring the original subject back into filteredSubjects.
  const initialSubjectAppliedRef = useRef(false);
  useEffect(() => {
    if (initialSubjectAppliedRef.current) return;
    if (!isEditSession || editValues.subject_id == null) return;
    const matches = filteredSubjects.some(
      (subject) => subject.id === editValues.subject_id
    );
    if (matches) {
      setValue("subject_id", String(editValues.subject_id));
      initialSubjectAppliedRef.current = true;
    }
  }, [filteredSubjects, isEditSession, editValues.subject_id, setValue]);

  function onSubmit(data: FieldValues) {
    const resolvedSemesterId = Number(semesterId || editValues.semester_id);
    if (!resolvedSemesterId) {
      toast.error("No se pudo determinar el semestre del horario.");
      return;
    }

    data.semester_id = resolvedSemesterId;

    const block = getBlockByStartTime(data.start_time as string);
    if (!block) {
      toast.error("Bloque horario inválido.");
      return;
    }
    data.end_time = block.end_time;

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
            // Passed through register()'s own `onChange` option, not as a
            // separate JSX prop -- a later plain `onChange={...}` prop on
            // the same element would silently replace react-hook-form's
            // registered handler, so the group value it tracks internally
            // (and later submits) would never actually update.
            onChange: (e) => {
              const newFilteredSubjects = computeFilteredSubjects(
                e.target.value
              );
              setFilteredSubjects(newFilteredSubjects);

              const currentSubjectId = getValues("subject_id");
              const stillValid = newFilteredSubjects.some(
                (subject) => String(subject.id) === currentSubjectId
              );
              if (!stillValid) {
                setValue("subject_id", "");
              }
            },
          })}
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
          disabled={isEditing}
          {...register("start_time", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          {SCHEDULE_BLOCKS.map((block) => (
            <option key={block.start_time} value={block.start_time}>
              {block.label}
            </option>
          ))}
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
