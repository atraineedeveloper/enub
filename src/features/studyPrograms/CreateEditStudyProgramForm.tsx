import Input from "../../ui/Input";
import { useForm } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import toast from "react-hot-toast";
import { useEditStudyProgram } from "./useEditStudyProgram";

function CreateEditStudyProgramForm({ programToEdit = {}, onCloseModal }: { programToEdit?: any; onCloseModal?: () => void }) {
  const { id: editId, ...editValues } = programToEdit;
  const isEditSession = Boolean(editId);
  const { isEditing, editStudyProgram } = useEditStudyProgram();

  const { register, handleSubmit, reset, formState } = useForm({
    defaultValues: isEditSession ? editValues : {},
  });
  const { errors } = formState;

  function onSubmit(data: any) {
    if (isEditSession) {
      editStudyProgram(
        { newProgram: { ...data }, id: editId },
        {
          onSuccess: () => {
            toast.success("Plan de estudio actualizado correctamente");
            reset();
            onCloseModal?.();
          },
        }
      );
    }
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormRow label="Año" error={errors?.year?.message as string}>
        <Input
          type="number"
          id="year"
          disabled={isEditing}
          {...register("year", { required: "Este campo es obligatorio" })}
        />
      </FormRow>
      <FormRow label="Nombre" error={errors?.name?.message as string}>
        <Input
          type="text"
          id="name"
          disabled={isEditing}
          {...register("name", { required: "Este campo es obligatorio" })}
        />
      </FormRow>
      <FormRow>
        <Button type="reset" variation="secondary" onClick={onCloseModal}>
          Cancelar
        </Button>
        <Button disabled={isEditing}>Guardar</Button>
      </FormRow>
    </Form>
  );
}

export default CreateEditStudyProgramForm;
