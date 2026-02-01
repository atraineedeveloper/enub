import Input from "../../ui/Input";
import { useForm } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import { useEditUtility } from "./useEditUtilities";

function CreateEditOtherForm({ otherToEdit = {}, onCloseModal }: { otherToEdit?: any; onCloseModal?: () => void }) {
  const { id: editId, ...editValues } = otherToEdit;
  const { isEditing, editUtility } = useEditUtility();
  const isEditSession = Boolean(editId);

  const { register, handleSubmit, reset, formState } = useForm({
    defaultValues: isEditSession ? editValues : {},
  });

  const { errors } = formState;

  function onSubmit(data: any) {
    if (isEditSession)
      editUtility(
        { newUtility: { ...data }, id: editId },
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
      <FormRow label="Fecha de expedición" error={errors?.description?.message as string}>
        <Input
          type="text"
          id="description"
          disabled={isEditing}
          {...register("description", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Valor" error={errors?.value?.message as string}>
        <Input
          type="text"
          id="value"
          disabled={isEditing}
          {...register("value", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow>
        <Button
          variation="secondary"
          type="reset"
          onClick={() => onCloseModal?.()}
        >
          Cancelar
        </Button>
        <Button>{isEditSession ? "Editar" : "Añadir"}</Button>
      </FormRow>
    </Form>
  );
}

export default CreateEditOtherForm;
