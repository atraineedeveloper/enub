import Input from "../../ui/Input";
import { useFieldArray, useForm, type FieldValues } from "react-hook-form";
import Form from "../../ui/Form";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import { useEditWorker } from "./useEditWorker";
import { useCreateWorker } from "./useCreateWorker";
import Select from "../../ui/Select";
import Textarea from "../../ui/Textarea";
import { PhotoCard, PhotoSection, PhotoSectionTitle, PhotoError, PhotoPreview, PhotoImage, PhotoActions, PhotoActionButton, HiddenInput, PlazasContainer, PlazaRow, PlazaActionButton, AddPlazaButton, AdmissionsContainer, AdmissionRow } from "./workerFormStyles";
import {
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineArrowUturnLeft,
  HiOutlineArrowUpTray,
  HiOutlinePlus,
  HiOutlineXMark,
} from "react-icons/hi2";
import { getProfilePicturePublicUrl } from "../../services/apiWorkers";
import { useEffect, useRef, useState } from "react";
import type { WorkerWithDetails } from "./useWorkers";
import { selectChangedWorkerRelations } from "./workerEditRelations";

function normalizeSustenanceTypeForForm(value = "") {
  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === "estatal") return "Estatal";
  if (normalizedValue === "federal") return "Federal";
  return "";
}

interface CreateEditWorkerFormProps {
  workerToEdit?: Partial<WorkerWithDetails>;
  onCloseModal?: () => void;
}

function CreateEditWorkerForm({
  workerToEdit = {},
  onCloseModal,
}: CreateEditWorkerFormProps) {
  const { id: editId, ...editValues } = workerToEdit;
  const isEditSession = Boolean(editId);
  const { isEditing, editWorker } = useEditWorker();
  const { isCreating, createWorker } = useCreateWorker();
  const isWorking = isEditing || isCreating;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [newPicturePreviewUrl, setNewPicturePreviewUrl] = useState("");
  const currentProfilePictureUrl = workerToEdit.profile_picture
    ? getProfilePicturePublicUrl(workerToEdit.profile_picture)
    : "";

  const { register, handleSubmit, reset, control, formState, watch, setValue } =
    useForm<FieldValues>({
      defaultValues: (isEditSession
        ? {
            ...editValues,
            sustenance_plazas:
              editValues.sustenance_plazas &&
              editValues.sustenance_plazas.length > 0
                ? editValues.sustenance_plazas.map((plaza) => ({
                    ...plaza,
                    sustenance: normalizeSustenanceTypeForForm(
                      plaza?.sustenance ?? ""
                    ),
                  }))
                : [{ sustenance: "", payment_key: "", plaza: "" }],
            date_of_admissions:
              editValues.date_of_admissions &&
              editValues.date_of_admissions.length > 0
                ? editValues.date_of_admissions.map((d) => ({
                    type: d.type ?? "",
                    date_of_admission: d.date_of_admission ?? "",
                  }))
                : [{ type: "", date_of_admission: "" }],
          }
        : {
            sustenance_plazas: [{ sustenance: "", payment_key: "", plaza: "" }],
            date_of_admissions: [{ type: "", date_of_admission: "" }],
          }) as FieldValues,
    });
  const { errors, dirtyFields } = formState;
  const { fields: plazaFields, append, remove } = useFieldArray({
    control,
    name: "sustenance_plazas",
  });
  const { fields: dateFields, append: appendDate, remove: removeDate } = useFieldArray({
    control,
    name: "date_of_admissions",
  });
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

  function onSubmit(data: FieldValues) {
    if (isEditSession) {
      const selectedProfilePicture = data.profile_picture_file?.[0];
      const removeCurrentProfilePicture = Boolean(data.remove_profile_picture);

      const { sustenancePlazas, dateOfAdmissions } =
        selectChangedWorkerRelations(dirtyFields, data);
      delete data.date_of_admissions;
      delete data.schedule_assignments;
      delete data.schedule_teachers;
      delete data.sustenance_plazas;
      delete data.profile_picture_file;
      delete data.remove_profile_picture;

      editWorker(
        {
          newWorker: { ...data },
          id: editId!,
          options: {
            profilePictureFile: selectedProfilePicture ?? null,
            removeCurrentProfilePicture: Boolean(
              selectedProfilePicture || removeCurrentProfilePicture
            ),
            currentProfilePicture: workerToEdit.profile_picture ?? null,
            sustenancePlazas,
            dateOfAdmissions,
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

    const dateOfAdmissions = (data.date_of_admissions ?? []).filter(
      (d: { type?: string; date_of_admission?: string }) =>
        d.type || d.date_of_admission
    );
    delete data.date_of_admissions;
    delete data.schedule_assignments;
    delete data.schedule_teachers;
    const sustenancePlazas = data.sustenance_plazas ?? [];
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
          sustenancePlazas,
          dateOfAdmissions,
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
          <PhotoError>{errors.profile_picture_file.message as string}</PhotoError>
        )}
      </PhotoSection>

      <FormRow label="Nombre" error={errors?.name?.message as string | undefined}>
        <Input
          type="text"
          id="name"
          disabled={isWorking}
          {...register("name", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Calle" error={errors?.street?.message as string | undefined}>
        <Input
          type="text"
          id="street"
          disabled={isWorking}
          {...register("street", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Colonia" error={errors?.neighborhood?.message as string | undefined}>
        <Input
          type="text"
          id="neighborhood"
          disabled={isWorking}
          {...register("neighborhood", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Código Postal" error={errors?.post_code?.message as string | undefined}>
        <Input
          type="text"
          id="post_code"
          disabled={isWorking}
          {...register("post_code", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Ciudad" error={errors?.city?.message as string | undefined}>
        <Input
          type="text"
          id="city"
          disabled={isWorking}
          {...register("city", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Estado" error={errors?.state?.message as string | undefined}>
        <Input
          type="text"
          id="state"
          disabled={isWorking}
          {...register("state", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Télefono" error={errors?.phone?.message as string | undefined}>
        <Input
          type="text"
          id="phone"
          disabled={isWorking}
          {...register("phone", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Correo Electrónico" error={errors?.email?.message as string | undefined}>
        <Input
          type="text"
          id="email"
          disabled={isWorking}
          {...register("email")}
        />
      </FormRow>
      <FormRow label="RFC" error={errors?.RFC?.message as string | undefined}>
        <Input
          type="text"
          id="RFC"
          disabled={isWorking}
          {...register("RFC", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Especialidad" error={errors?.specialty?.message as string | undefined}>
        <Input
          type="text"
          id="specialty"
          disabled={isWorking}
          {...register("specialty", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow label="Tipo de Trabajador" error={errors?.type_worker?.message as string | undefined}>
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
        label="Plazas"
        alignTop
        error={
          (errors?.sustenance_plazas?.message ||
            errors?.sustenance_plazas?.root?.message) as string | undefined
        }
      >
        <PlazasContainer>
          {plazaFields.map((field, index) => (
            <PlazaRow key={field.id}>
              <Select
                disabled={isWorking}
                {...register(`sustenance_plazas.${index}.sustenance`)}
              >
                <option value="">Sostenimiento...</option>
                <option value="Estatal">Estatal</option>
                <option value="Federal">Federal</option>
              </Select>
              <Input
                type="text"
                placeholder="Clave de pago"
                disabled={isWorking}
                {...register(`sustenance_plazas.${index}.payment_key`)}
              />
              <Input
                type="text"
                placeholder="Plaza"
                disabled={isWorking}
                {...register(`sustenance_plazas.${index}.plaza`)}
              />
              <PlazaActionButton
                type="button"
                onClick={() => remove(index)}
                disabled={isWorking || plazaFields.length === 1}
                title="Eliminar fila"
                aria-label="Eliminar fila"
              >
                <HiOutlineXMark />
              </PlazaActionButton>
            </PlazaRow>
          ))}
          <AddPlazaButton
            type="button"
            onClick={() =>
              append({ sustenance: "", payment_key: "", plaza: "" })
            }
            disabled={isWorking}
          >
            <HiOutlinePlus />
            Agregar plaza
          </AddPlazaButton>
        </PlazasContainer>
      </FormRow>
      <FormRow label="Fechas de admisión" alignTop>
        <AdmissionsContainer>
          {dateFields.map((field, index) => (
            <AdmissionRow key={field.id}>
              <Select
                disabled={isWorking}
                {...register(`date_of_admissions.${index}.type`)}
              >
                <option value="">Tipo...</option>
                <option value="SEP">SEP</option>
                <option value="EDO">EDO</option>
                <option value="FED">FED</option>
                <option value="RAMA">RAMA</option>
              </Select>
              <Input
                type="date"
                disabled={isWorking}
                {...register(`date_of_admissions.${index}.date_of_admission`)}
              />
              <PlazaActionButton
                type="button"
                onClick={() => removeDate(index)}
                disabled={isWorking || dateFields.length === 1}
                title="Eliminar fila"
                aria-label="Eliminar fila"
              >
                <HiOutlineXMark />
              </PlazaActionButton>
            </AdmissionRow>
          ))}
          <AddPlazaButton
            type="button"
            onClick={() => appendDate({ type: "", date_of_admission: "" })}
            disabled={isWorking}
          >
            <HiOutlinePlus />
            Agregar fecha
          </AddPlazaButton>
        </AdmissionsContainer>
      </FormRow>
      <FormRow
        label="Función que desempeña"
        error={errors?.function_performed?.message as string | undefined}
      >
        <Textarea
          id="function_performed"
          disabled={isWorking}
          {...register("function_performed")}
        />
      </FormRow>
      <FormRow label="Observaciones" error={errors?.observations?.message as string | undefined}>
        <Textarea
          id="observations"
          disabled={isWorking}
          {...register("observations")}
        />
      </FormRow>
      <FormRow label="Estatus" error={errors?.status?.message as string | undefined}>
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
