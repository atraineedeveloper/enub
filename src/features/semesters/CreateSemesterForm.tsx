import { useForm } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import Select from "../../ui/Select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSemester } from "../../services/apiSemesters";
import toast from "react-hot-toast";

interface CreateSemesterFormProps {
  onCloseModal?: () => void;
}

function CreateSemesterForm({ onCloseModal }: CreateSemesterFormProps) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState } = useForm();
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

  function onSubmit(data: object) {
    mutate(data);
  }

  // Generate years and school years to options

  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  const options = Array.from({ length: 3 }, (_, i) => {
    const year = currentYear + i; // Año actual + i
    return [`${year.toString().slice(-2)}A`, `${year.toString().slice(-2)}B`];
  }).flat();

  const optionsYear = Array.from({ length: 4 }, (_, i) => {
    const startYear = lastYear + i;
    const endYear = startYear + 1;
    return `${startYear} - ${endYear}`;
  });

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
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </FormRow>
      <FormRow label="Ciclo Escolar" error={errors?.school_year?.message as string | undefined}>
        <Select
          id="school_year"
          disabled={isCreating}
          {...register("school_year", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          {optionsYear.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </FormRow>

      <FormRow>
        <Button variation="secondary" type="button" onClick={onCloseModal}>
          Cancelar
        </Button>
        <Button>Agregar Semestre</Button>
      </FormRow>
    </Form>
  );
}

export default CreateSemesterForm;
