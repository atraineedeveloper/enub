import { useForm } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import Select from "../../ui/Select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Input from "../../ui/Input";
import { useDegrees } from "../degrees/useDegrees";
import Spinner from "../../ui/Spinner";
import { createGroup } from "../../services/apiGroups";

function CreateGroupForm() {
  const queryClient = useQueryClient();

  const { isLoading, degrees } = useDegrees();
  const { register, handleSubmit, reset, formState } = useForm();
  const { errors } = formState;

  const { mutate, isPending: isCreating } = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      toast.success("El registro se creó correctamente");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <Spinner />;

  function onSubmit(data: any) {
    mutate(data);
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow
        label="Año de admisión"
        error={errors?.year_of_admission?.message as string}
      >
        <Input
          type="text"
          id="year_of_admission"
          disabled={isCreating}
          {...register("year_of_admission", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Letra (Grupo)" error={errors?.letter?.message as string}>
        <Input
          type="text"
          id="letter"
          disabled={isCreating}
          {...register("letter", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Carrera" error={errors?.degree_id?.message as string}>
        <Select
          id="degree_id"
          disabled={isCreating}
          {...register("degree_id", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione</option>
          {degrees?.map((degree: any) => (
            <option value={degree.id} key={degree.id}>
              {degree.code}
            </option>
          ))}
        </Select>
      </FormRow>
      <FormRow>
        <Button variation="secondary" type="reset">
          Cancelar
        </Button>
        <Button>Agregar Grupo</Button>
      </FormRow>
    </Form>
  );
}

export default CreateGroupForm;
