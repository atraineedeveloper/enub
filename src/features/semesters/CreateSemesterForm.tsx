import { useForm } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import Select from "../../ui/Select";
import Spinner from "../../ui/Spinner";
import ErrorMessage from "../../ui/ErrorMessage";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSemester } from "../../services/apiSemesters";
import { useSemesters } from "./useSemesters";
import {
  findLatestSemester,
  formatSemesterCode,
  getNextSemester,
  getSchoolYearForSemester,
  parseSemesterCode,
} from "./nextSemesterCode";
import toast from "react-hot-toast";

interface CreateSemesterFormProps {
  onCloseModal?: () => void;
}

function CreateSemesterForm({ onCloseModal }: CreateSemesterFormProps) {
  const queryClient = useQueryClient();
  const { isLoading, semesters, error } = useSemesters();

  const { register, handleSubmit, reset, watch, formState } = useForm();
  const { errors } = formState;

  const { mutate, isPending: isCreating } = useMutation({
    mutationFn: createSemester,
    onSuccess: () => {
      toast.success("El registro se creó correctamente");
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
      reset();
      onCloseModal?.();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={error.message} />;

  const latest = findLatestSemester(semesters ?? []);

  // Normal path: at least one existing semester parses successfully --
  // compute and offer only the exact next chronological semester, with no
  // manual semester/school_year selection.
  if (latest) {
    const nextCode = getNextSemester(latest);
    const nextSemester = formatSemesterCode(nextCode);
    const nextSchoolYear = getSchoolYearForSemester(nextCode);

    function onSubmit() {
      mutate({ semester: nextSemester, school_year: nextSchoolYear });
    }

    return (
      <Form onSubmit={handleSubmit(onSubmit)}>
        <FormRow label="Siguiente semestre">
          <p>{nextSemester}</p>
        </FormRow>
        <FormRow label="Ciclo Escolar">
          <p>{nextSchoolYear}</p>
        </FormRow>

        <FormRow>
          <Button variation="secondary" type="button" onClick={onCloseModal}>
            Cancelar
          </Button>
          <Button disabled={isCreating}>Agregar Semestre</Button>
        </FormRow>
      </Form>
    );
  }

  // Initial path: no existing semester parses successfully -- the admin
  // picks only a starting semester code; school_year is still always
  // derived automatically, never independently selected.
  const currentYear = new Date().getFullYear();
  const candidateOptions = Array.from({ length: 3 }, (_, i) => {
    const year = currentYear + i;
    return [`${year.toString().slice(-2)}A`, `${year.toString().slice(-2)}B`];
  }).flat();

  const selectedCode = watch("semester");
  const selectedParsed = parseSemesterCode(selectedCode);
  const selectedSchoolYear = selectedParsed
    ? getSchoolYearForSemester(selectedParsed)
    : "";

  function onSubmit() {
    const parsed = parseSemesterCode(selectedCode);
    if (!parsed) return;
    mutate({
      semester: formatSemesterCode(parsed),
      school_year: getSchoolYearForSemester(parsed),
    });
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label="Semestre" error={errors?.semester?.message as string | undefined}>
        <Select
          id="semester"
          disabled={isCreating}
          {...register("semester", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          {candidateOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </FormRow>
      <FormRow label="Ciclo Escolar">
        <p>{selectedSchoolYear || "—"}</p>
      </FormRow>

      <FormRow>
        <Button variation="secondary" type="button" onClick={onCloseModal}>
          Cancelar
        </Button>
        <Button disabled={isCreating}>Agregar Semestre</Button>
      </FormRow>
    </Form>
  );
}

export default CreateSemesterForm;
