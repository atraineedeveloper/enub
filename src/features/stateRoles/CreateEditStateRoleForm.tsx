import Input from "../../ui/Input";
import { useForm } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import { useEditStateRole } from "./useEditStateRole";

function CreateEditStateRoleForm({ stateRoleToEdit = {} }: { stateRoleToEdit?: any }) {
  const { id: editId, ...editValues } = stateRoleToEdit;
  const { isEditing, editStateRole } = useEditStateRole();
  const isEditSession = Boolean(editId);

  const { register, handleSubmit, reset, formState } = useForm({
    defaultValues: isEditSession ? editValues : {},
  });

  const { errors } = formState;

  function onSubmit(data: any) {
    if (isEditSession)
      editStateRole(
        { newStateRole: { ...data }, id: editId },
        {
          onSuccess: (data) => {
            reset();
          },
        }
      );
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label="Rol Estatal" error={errors?.role?.message as string}>
        <Input
          type="text"
          id="role"
          disabled={isEditing}
          {...register("role", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Trabajador" error={errors?.name_worker?.message as string}>
        <Input
          type="text"
          id="name_worker"
          disabled={isEditing}
          {...register("name_worker", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow>
        <Button>
          {isEditSession ? "Editar Rol Estatal" : "Añadir Rol Estatal"}
        </Button>
      </FormRow>
    </Form>
  );
}

export default CreateEditStateRoleForm;
