import { useForm } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import Select from "../../ui/Select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSemester } from "../../services/apiSemesters";
import toast from "react-hot-toast";

function CreateSemesterForm({ onCloseModal }) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState } = useForm();
  const { errors } = formState;

  const { mutate, isLoading: isCreating } = useMutation({
    mutationFn: createSemester,
    onSuccess: () => {
      toast.success("El registro se creó correctamente");
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
      reset();
      onCloseModal?.();
    },
    onError: (err) => toast.error(err.message),
  });

  function onSubmit(data) {
    mutate(data);
  }

  // Generate years and school years to options

  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  const options = [];
  const optionsYear = [];

  for (let i = 0; i < 3; i++) {
    const year = currentYear + i; // Año actual + i
    options.push(`${year.toString().slice(-2)}A`);
    options.push(`${year.toString().slice(-2)}B`);
  }

  for (let i = 0; i < 4; i++) {
    const startYear = lastYear + i;
    const endYear = startYear + 1;
    optionsYear.push(`${startYear} - ${endYear}`);
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label="Semestre" error={errors?.semester?.message}>
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
      <FormRow label="Ciclo Escolar" error={errors?.school_year?.message}>
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
