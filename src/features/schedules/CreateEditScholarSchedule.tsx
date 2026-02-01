// @ts-nocheck
import { useForm } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import Select from "../../ui/Select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useContext, useEffect, useState } from "react";
import calculateSemesterGroup from "../../helpers/calculateSemesterGroup";
import { createScheduleAssignments } from "../../services/apiScheduleAssignments";
import { useEditScheduleAssignment } from "./useEditScheduleAssignments";
import { SemesterContext } from "../../pages/ScheduleDashboard";
import { useCreateScheduleAssignments } from "./useCreateScheduleAssignments";
import type { Group, Subject, Worker } from "../../types/entities";
import type { FieldErrors } from "react-hook-form";

function CreateEditScholarSchedule({
  semesterId,
  scheduleToEdit = {},
  onCloseModal,
}) {
  const { isEditing, editScheduleAssignment } = useEditScheduleAssignment();
  const { isCreating, createScheduleAssignments } =
    useCreateScheduleAssignments();
  const isWorking = isCreating || isEditing;

  const semesterData = useContext(SemesterContext);
  // console.log(semesterData);

  const groups: Group[] = semesterData?.groups ?? [];
  const workers: Worker[] = semesterData?.workers ?? [];
  const subjects: Subject[] = semesterData?.subjects ?? [];

  const { id: editId, ...editValues } = scheduleToEdit;
  const isEditSession = Boolean(editId);

  useEffect(() => {
    if (isEditSession) {
      selectingGroup(editValues.group_id);
    }
  }, [isEditSession, editValues.group_id]);

  type ScholarForm = {
    weekday: string;
    group_id: number;
    subject_id: number;
    start_time: string;
    end_time: string;
    worker_id: number;
  };

  const { register, handleSubmit, reset, formState } = useForm<ScholarForm>({
    defaultValues: (isEditSession ? editValues : {}) as Partial<ScholarForm>,
  });
  const { errors } = formState as { errors: FieldErrors<ScholarForm> };

  const [filteredSubjects, setFilteredSubjects] = useState<Subject[]>([]);

  function selectingGroup(value: string | number) {
    const groupFound = groups.find((gp) => gp.id === +value);
    if (!groupFound) {
      setFilteredSubjects([]);
      return;
    }

    const semesterFound = calculateSemesterGroup(groupFound.year_of_admission);

    const subjectsFilterSemester = subjects.filter((subject) => {
      return subject.semester == semesterFound;
    });

    const subjectsFilterDegree = subjectsFilterSemester.filter((subject) => {
      return subject.degrees.id === groupFound.degrees.id;
    });

    setFilteredSubjects(subjectsFilterDegree);
  }

  function onSubmit(data) {
    // console.log(data);

    const payload = { ...data, semester_id: semesterId ? +semesterId : undefined };
    if (isEditSession) {
      editScheduleAssignment(
        { newScheduleAssignment: { ...payload }, id: editId },
        {
          onSuccess: (data) => {
            reset();
            onCloseModal?.();
          },
        }
      );
    } else
      createScheduleAssignments(
        { ...payload },
        {
          onSuccess: (data) => {
            reset();
            onCloseModal?.();
          },
        }
      );
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label="Dia de la semana" error={errors?.weekday?.message}>
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
      <FormRow label="Grupo Escolar" error={errors?.group_id?.message}>
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
              {calculateSemesterGroup(group.year_of_admission)}° "{group.letter}
              " - {group.degrees.code}
            </option>
          ))}
        </Select>
      </FormRow>
      <FormRow label="Asignatura" error={errors?.subject_id?.message}>
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
              {subject.study_programs.year} - {subject.degrees.code})
            </option>
          ))}
        </Select>
      </FormRow>
      <FormRow label="Hora de inicio" error={errors?.start_time?.message}>
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
      <FormRow label="Hora Fin" error={errors?.end_time?.message}>
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
      <FormRow label="Maestro" error={errors?.worker_id?.message}>
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
