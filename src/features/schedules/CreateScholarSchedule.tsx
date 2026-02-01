// @ts-nocheck
import { useForm } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import Select from "../../ui/Select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useState } from "react";
import calculateSemesterGroup from "../../helpers/calculateSemesterGroup";
import { createScheduleAssignments } from "../../services/apiScheduleAssignments";
import capitalizeName from "../../helpers/capitalizeFirstLetter";
import type { Subject, Worker, Group } from "../../types/entities";

type FormValues = {
  weekday: string;
  group_id: number;
  subject_id: number;
  start_time: string;
  end_time: string;
  worker_id: number;
  semester_id?: number | string;
};

function CreateScholarSchedule({
  workers,
  subjects,
  groups,
  semesterId,
  onCloseModal,
}: {
  workers: Worker[];
  subjects: Subject[];
  groups: Group[];
  semesterId: string | undefined;
  onCloseModal?: () => void;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState } = useForm<FormValues>();
  const { errors } = formState;
  const { mutate, isLoading: isCreating } = useMutation({
    mutationFn: createScheduleAssignments,
    onSuccess: () => {
      toast.success("El registro se creó correctamente");
      queryClient.invalidateQueries({ queryKey: ["scheduleAssignments"] });
      reset();
      onCloseModal?.();
    },
    onError: (err) => toast.error(err.message),
  });

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

  function onSubmit(data: FormValues) {
    mutate({ ...data, semester_id: semesterId ? +semesterId : undefined });
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label="Dia de la semana" error={errors?.weekday?.message}>
        <Select
          id="weekday"
          disabled={isCreating}
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
          disabled={isCreating}
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
          disabled={isCreating}
          {...register("subject_id", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          {filteredSubjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.semester}° - {subject.name.toUpperCase()} (
              {subject.study_programs.year} - {subject.degrees.code})
            </option>
          ))}
        </Select>
      </FormRow>
      <FormRow label="Hora de inicio" error={errors?.start_time?.message}>
        <Select
          id="start_time"
          disabled={isCreating}
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
          disabled={isCreating}
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
          disabled={isCreating}
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
      <FormRow>
        <Button
          variation="secondary"
          type="reset"
          onClick={() => onCloseModal?.()}
        >
          Cancelar
        </Button>
        <Button>Agregar Horario</Button>
      </FormRow>
    </Form>
  );
}

export default CreateScholarSchedule;
