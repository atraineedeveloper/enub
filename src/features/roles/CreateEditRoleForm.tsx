import Input from "../../ui/Input";
import { useForm } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import { useEditRole } from "./useEditRole";
import { useWorkers } from "../workers/useWorkers";
import Spinner from "../../ui/Spinner";
import Select from "../../ui/Select";
import toast from "react-hot-toast";

function CreateEditRoleForm({ roleToEdit = {}, onCloseModal }: { roleToEdit?: any; onCloseModal?: () => void }) {
  const { id: editId, ...editValues } = roleToEdit;
  const { isEditing, editRole } = useEditRole();
  const isEditSession = Boolean(editId);

  const { register, handleSubmit, reset, formState } = useForm({
    defaultValues: isEditSession ? editValues : {},
  });

  const { isLoading: isLoadingWorkers, workers } = useWorkers();

  const { errors } = formState;

  if (isLoadingWorkers) return <Spinner />;

  function onSubmit(data: any) {
    delete data.workers;

    if (isEditSession)
      editRole(
        { newRole: { ...data }, id: editId },
        {
          onSuccess: (data) => {
            toast.success("El registro se creó correctamente");
            reset();
            onCloseModal?.();
          },
        }
      );
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label="Rol Escolar" error={errors?.role?.message as string}>
        <Input
          type="text"
          id="role"
          disabled={isEditing}
          {...register("role", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      {
        <FormRow label="Trabajador" error={errors?.worker_id?.message as string}>
          <Select
            id="worker_id"
            disabled={isEditing}
            {...register("worker_id", {
              required: "Este campo es requerido",
            })}
          >
            <option value="">Seleccione...</option>
            {workers?.map((worker: any) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </Select>
        </FormRow>
      }
      <FormRow>
        <Button
          variation="secondary"
          type="reset"
          onClick={() => onCloseModal?.()}
        >
          Cancelar
        </Button>
        <Button>
          {isEditSession ? "Editar Rol Escolar" : "Añadir Rol Escolar"}
        </Button>
      </FormRow>
    </Form>
  );
}

export default CreateEditRoleForm;
