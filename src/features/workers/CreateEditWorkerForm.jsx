import Input from "../../ui/Input";
import { useForm } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import { useEditWorker } from "./useEditWorker";
import { useCreateWorker } from "./useCreateWorker";
import Select from "../../ui/Select";
import Textarea from "../../ui/Textarea";
import styled from "styled-components";
import {
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineArrowUturnLeft,
  HiOutlineArrowUpTray,
} from "react-icons/hi2";
import { getProfilePicturePublicUrl } from "../../services/apiWorkers";
import { useEffect, useRef, useState } from "react";

const PhotoCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
  padding: 1.2rem;
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  background: linear-gradient(
    145deg,
    var(--color-grey-50),
    color-mix(in oklab, var(--color-grey-0) 80%, var(--color-brand-50))
  );
`;

const PhotoSection = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 0 0 1.6rem;
  margin-bottom: 1.2rem;
  border-bottom: 1px solid var(--color-grey-100);
`;

const PhotoSectionTitle = styled.p`
  font-size: 1.8rem;
  font-weight: 600;
  color: var(--color-grey-700);
  text-align: center;
`;

const PhotoError = styled.span`
  font-size: 1.4rem;
  color: var(--color-red-700);
`;

const PhotoPreview = styled.div`
  width: 10rem;
  height: 10rem;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--color-grey-200);
  box-shadow: var(--shadow-sm);
  display: grid;
  place-items: center;
  background-color: var(--color-grey-100);
  color: var(--color-grey-500);
  font-size: 1.2rem;
  text-align: center;
  padding: 0.8rem;
`;

const PhotoImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
`;

const PhotoActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
`;

const PhotoActionButton = styled.button`
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--color-grey-300);
  border-radius: 999px;
  background-color: var(--color-grey-0);
  width: 3.2rem;
  height: 3.2rem;

  &:hover {
    background-color: var(--color-grey-100);
  }

  & svg {
    width: 1.6rem;
    height: 1.6rem;
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

function CreateEditWorkerForm({ workerToEdit = {}, onCloseModal }) {
  const { id: editId, ...editValues } = workerToEdit;
  const isEditSession = Boolean(editId);
  const { isEditing, editWorker } = useEditWorker();
  const { isCreating, createWorker } = useCreateWorker();
  const isWorking = isEditing || isCreating;
  const fileInputRef = useRef(null);
  const [newPicturePreviewUrl, setNewPicturePreviewUrl] = useState("");
  const currentProfilePictureUrl = workerToEdit.profile_picture
    ? getProfilePicturePublicUrl(workerToEdit.profile_picture)
    : "";

  const { register, handleSubmit, reset, formState, watch, setValue } = useForm({
    defaultValues: isEditSession ? editValues : {},
  });
  const { errors } = formState;
  const profilePictureField = register("profile_picture_file", {
    validate: (fileList) => {
      const selectedFile = fileList?.[0];
      if (!selectedFile) return true;
      return (
        selectedFile.size <= 5 * 1024 * 1024 ||
        "La foto debe pesar máximo 5MB"
      );
    },
    onChange: () => setValue("remove_profile_picture", false, { shouldDirty: true }),
  });
  const removeProfilePictureField = register("remove_profile_picture");
  const selectedProfilePicture = watch("profile_picture_file");
  const removeCurrentProfilePicture = Boolean(watch("remove_profile_picture"));
  const hasPictureVisible = Boolean(
    !removeCurrentProfilePicture && (newPicturePreviewUrl || currentProfilePictureUrl)
  );

  useEffect(() => {
    const selectedFile = selectedProfilePicture?.[0];
    if (!selectedFile) {
      setNewPicturePreviewUrl("");
      return;
    }

    const temporaryUrl = URL.createObjectURL(selectedFile);
    setNewPicturePreviewUrl(temporaryUrl);

    return () => URL.revokeObjectURL(temporaryUrl);
  }, [selectedProfilePicture]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleRemovePicture() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setValue("profile_picture_file", null, { shouldDirty: true });

    if (workerToEdit.profile_picture) {
      setValue("remove_profile_picture", true, { shouldDirty: true });
    }
  }

  function handleRestorePicture() {
    setValue("remove_profile_picture", false, { shouldDirty: true });
  }

  function onSubmit(data) {
    if (isEditSession) {
      const selectedProfilePicture = data.profile_picture_file?.[0];
      const removeCurrentProfilePicture = Boolean(data.remove_profile_picture);

      delete data.date_of_admissions;
      delete data.schedule_assignments;
      delete data.schedule_teachers;
      delete data.sustenance_plazas;
      delete data.profile_picture_file;
      delete data.remove_profile_picture;

      editWorker(
        {
          newWorker: { ...data },
          id: editId,
          options: {
            profilePictureFile: selectedProfilePicture ?? null,
            removeCurrentProfilePicture: Boolean(
              selectedProfilePicture || removeCurrentProfilePicture
            ),
            currentProfilePicture: workerToEdit.profile_picture ?? null,
          },
        },
        {
          onSuccess: () => {
            reset();
            onCloseModal?.();
          },
        }
      );
      return;
    }

    const selectedProfilePicture = data.profile_picture_file?.[0];

    delete data.date_of_admissions;
    delete data.schedule_assignments;
    delete data.schedule_teachers;
    delete data.sustenance_plazas;
    delete data.profile_picture_file;
    delete data.remove_profile_picture;

    createWorker(
      {
        newWorker: { ...data },
        options: {
          profilePictureFile: selectedProfilePicture ?? null,
          removeCurrentProfilePicture: false,
          currentProfilePicture: null,
        },
      },
      {
        onSuccess: () => {
          reset();
          onCloseModal?.();
        },
      }
    );
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <PhotoSection>
        <PhotoSectionTitle>Foto de perfil</PhotoSectionTitle>
        <PhotoCard>
          <PhotoPreview>
            {removeCurrentProfilePicture ? (
              <span>Foto eliminada</span>
            ) : newPicturePreviewUrl ? (
              <PhotoImage src={newPicturePreviewUrl} alt="Nueva foto seleccionada" />
            ) : currentProfilePictureUrl ? (
              <PhotoImage src={currentProfilePictureUrl} alt={`Foto de ${workerToEdit.name}`} />
            ) : (
              <span>Sin foto</span>
            )}
          </PhotoPreview>

          <PhotoActions>
            <PhotoActionButton
              type="button"
              onClick={openFilePicker}
              disabled={isWorking}
              title={hasPictureVisible ? "Editar imagen" : "Subir imagen"}
              aria-label={hasPictureVisible ? "Editar imagen" : "Subir imagen"}
            >
              {hasPictureVisible ? <HiOutlinePencilSquare /> : <HiOutlineArrowUpTray />}
            </PhotoActionButton>

            {hasPictureVisible && (
              <PhotoActionButton
                type="button"
                onClick={handleRemovePicture}
                disabled={isWorking}
                title="Eliminar imagen"
                aria-label="Eliminar imagen"
              >
                <HiOutlineTrash />
              </PhotoActionButton>
            )}

            {removeCurrentProfilePicture && workerToEdit.profile_picture && (
              <PhotoActionButton
                type="button"
                onClick={handleRestorePicture}
                disabled={isWorking}
                title="Restaurar imagen"
                aria-label="Restaurar imagen"
              >
                <HiOutlineArrowUturnLeft />
              </PhotoActionButton>
            )}
          </PhotoActions>

          <HiddenInput
            type="file"
            id="profile_picture_file"
            accept="image/*"
            disabled={isWorking}
            {...profilePictureField}
            ref={(event) => {
              profilePictureField.ref(event);
              fileInputRef.current = event;
            }}
          />

          <HiddenInput
            type="checkbox"
            id="remove_profile_picture"
            {...removeProfilePictureField}
          />
        </PhotoCard>
        {errors?.profile_picture_file?.message && (
          <PhotoError>{errors.profile_picture_file.message}</PhotoError>
        )}
      </PhotoSection>

      <FormRow label="Nombre" error={errors?.name?.message}>
        <Input
          type="text"
          id="name"
          disabled={isWorking}
          {...register("name", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Calle" error={errors?.street?.message}>
        <Input
          type="text"
          id="street"
          disabled={isWorking}
          {...register("street", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Colonia" error={errors?.neighborhood?.message}>
        <Input
          type="text"
          id="neighborhood"
          disabled={isWorking}
          {...register("neighborhood", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Código Postal" error={errors?.post_code?.message}>
        <Input
          type="text"
          id="post_code"
          disabled={isWorking}
          {...register("post_code", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Ciudad" error={errors?.city?.message}>
        <Input
          type="text"
          id="city"
          disabled={isWorking}
          {...register("city", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Estado" error={errors?.state?.message}>
        <Input
          type="text"
          id="state"
          disabled={isWorking}
          {...register("state", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Télefono" error={errors?.phone?.message}>
        <Input
          type="text"
          id="phone"
          disabled={isWorking}
          {...register("phone", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Correo Electrónico" error={errors?.email?.message}>
        <Input
          type="text"
          id="email"
          disabled={isWorking}
          {...register("email")}
        />
      </FormRow>
      <FormRow label="RFC" error={errors?.RFC?.message}>
        <Input
          type="text"
          id="RFC"
          disabled={isWorking}
          {...register("RFC", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Especialidad" error={errors?.specialty?.message}>
        <Input
          type="text"
          id="specialty"
          disabled={isWorking}
          {...register("specialty", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Tipo de Trabajador" error={errors?.type_worker?.message}>
        <Select
          id="type_worker"
          disabled={isWorking}
          {...register("type_worker", {
            required: "Este campo es requerido",
          })}
        >
          <option value="">Seleccione...</option>
          <option value="Maestro">Maestro</option>
          <option value="Administrativo">Administrativo y de Apoyo</option>
          <option value="Contratacion">Contratación</option>
        </Select>
      </FormRow>
      <FormRow
        label="Función que desempeña"
        error={errors?.function_performed?.message}
      >
        <Textarea
          id="function_performed"
          disabled={isWorking}
          {...register("function_performed")}
        />
      </FormRow>
      <FormRow label="Observaciones" error={errors?.observations?.message}>
        <Textarea
          id="observations"
          disabled={isWorking}
          {...register("observations")}
        />
      </FormRow>
      <FormRow label="Estatus" error={errors?.status?.message}>
        <Select id="status" disabled={isWorking} {...register("status")}>
          <option value="">Seleccione...</option>
          <option value="1">Activo</option>
          <option value="0">Inactivo</option>
        </Select>
      </FormRow>
      <FormRow>
        <Button
          variation="secondary"
          type="reset"
          onClick={() => onCloseModal?.()}
          disabled={isWorking}
        >
          Cancelar
        </Button>
        <Button disabled={isWorking}>
          {isEditSession ? "Actualizar trabajador" : "Añadir Trabajador"}
        </Button>
      </FormRow>
    </Form>
  );
}

export default CreateEditWorkerForm;
