import Input from "../../ui/Input";
import { useForm } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import { useEditStateRole } from "./useEditStateRole";
import type { StateRole } from "./useStateRoles";

interface CreateEditStateRoleFormProps {
  stateRoleToEdit?: Partial<StateRole>;
  onCloseModal?: () => void;
}

function CreateEditStateRoleForm({
  stateRoleToEdit = {},
  onCloseModal,
}: CreateEditStateRoleFormProps) {
  const { id: editId, ...editValues } = stateRoleToEdit;
  const { isEditing, editStateRole } = useEditStateRole();
  const isEditSession = Boolean(editId);

  const { register, handleSubmit, reset, formState } = useForm({
    defaultValues: isEditSession ? editValues : {},
  });

  const { errors } = formState;

  function onSubmit(data: Record<string, unknown>) {
    if (isEditSession)
      editStateRole(
        { newStateRole: { ...data }, id: editId },
        {
          // Modal.Window always injects an `onCloseModal` prop via
          // cloneElement onto whatever it renders -- this form just never
          // declared/read it (pre-existing gap, predates this migration's
          // TypeScript conversion; confirmed via the original .jsx). Wired
          // up here to match CreateEditOtherForm.tsx's identical pattern:
          // closing the modal right after reset() is also what makes that
          // form's brief revert-to-stale-defaultValues (an artifact of
          // react-hook-form's no-argument `reset()` restoring the
          // originally-captured `defaultValues`, not fresh post-update
          // data) invisible to the user there.
          onSuccess: () => {
            reset();
            onCloseModal?.();
          },
        }
      );
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label="Rol Estatal" error={errors?.role?.message as string | undefined}>
        <Input
          type="text"
          id="role"
          disabled={isEditing}
          {...register("role", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Trabajador" error={errors?.name_worker?.message as string | undefined}>
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
