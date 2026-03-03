import supabase from "./supabase";

const PROFILE_PICTURES_BUCKET = "profile_pictures";
const ALLOWED_SUSTENANCE_TYPES = new Set(["Estatal", "Federal"]);

function normalizeSustenanceType(value = "") {
  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === "estatal") return "Estatal";
  if (normalizedValue === "federal") return "Federal";
  return value.trim();
}

function getFileExtension(fileName = "") {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "jpg";
}

function createProfilePictureName(file) {
  const extension = getFileExtension(file?.name);
  return `worker-${crypto.randomUUID()}.${extension}`;
}

async function uploadProfilePicture(file) {
  const fileName = createProfilePictureName(file);

  const { error } = await supabase.storage
    .from(PROFILE_PICTURES_BUCKET)
    .upload(fileName, file, { upsert: false });

  if (error) {
    console.error(error);
    throw new Error("La foto no pudo subirse");
  }

  return fileName;
}

async function removeProfilePicture(fileName) {
  if (!fileName) return;

  const { error } = await supabase.storage
    .from(PROFILE_PICTURES_BUCKET)
    .remove([fileName]);

  if (error) throw error;
}

function normalizeSustenancePlazas(sustenancePlazas = []) {
  if (!Array.isArray(sustenancePlazas)) return [];

  return sustenancePlazas
    .map((plaza) => ({
      sustenance: normalizeSustenanceType(plaza?.sustenance ?? ""),
      payment_key: plaza?.payment_key?.trim() ?? "",
      plaza: plaza?.plaza?.trim() ?? "",
    }))
    .filter(
      (plaza) => plaza.sustenance || plaza.payment_key || plaza.plaza
    );
}

function validateSustenancePlazas(sustenancePlazas = []) {
  for (const sustenancePlaza of sustenancePlazas) {
    if (
      !sustenancePlaza.sustenance ||
      !sustenancePlaza.payment_key ||
      !sustenancePlaza.plaza
    ) {
      throw new Error(
        "Cada plaza debe tener sostenimiento, clave de pago y plaza"
      );
    }
    if (!ALLOWED_SUSTENANCE_TYPES.has(sustenancePlaza.sustenance)) {
      throw new Error("El sostenimiento debe ser Estatal o Federal");
    }
  }
}

async function replaceWorkerDateOfAdmissions(workerId, dateOfAdmissions = []) {
  const { error: deleteError } = await supabase
    .from("date_of_admissions")
    .delete()
    .eq("worker_id", workerId);

  if (deleteError) {
    console.error(deleteError);
    throw new Error("Las fechas de admisión no pudieron actualizarse");
  }

  if (!dateOfAdmissions.length) return;

  const rowsToInsert = dateOfAdmissions.map((d) => ({
    type: d.type || null,
    date_of_admission: d.date_of_admission || null,
    worker_id: workerId,
  }));

  const { error: insertError } = await supabase
    .from("date_of_admissions")
    .insert(rowsToInsert);

  if (insertError) {
    console.error(insertError);
    throw new Error("Las fechas de admisión no pudieron actualizarse");
  }
}

async function replaceWorkerSustenancePlazas(workerId, sustenancePlazas = []) {
  const { error: deleteError } = await supabase
    .from("sustenance_plazas")
    .delete()
    .eq("worker_id", workerId);

  if (deleteError) {
    console.error(deleteError);
    throw new Error("Las plazas no pudieron actualizarse");
  }

  if (!sustenancePlazas.length) return;

  const rowsToInsert = sustenancePlazas.map((plaza) => ({
    ...plaza,
    worker_id: workerId,
  }));

  const { error: insertError } = await supabase
    .from("sustenance_plazas")
    .insert(rowsToInsert);

  if (insertError) {
    console.error(insertError);
    throw new Error("Las plazas no pudieron actualizarse");
  }
}

export function getProfilePicturePublicUrl(fileName) {
  if (!fileName) return "";

  const { data } = supabase.storage
    .from(PROFILE_PICTURES_BUCKET)
    .getPublicUrl(fileName);

  return data.publicUrl;
}

export async function getWorkersFull() {
  const { data, error } = await supabase
    .from("workers")
    .select("*, date_of_admissions(*), sustenance_plazas(*)");

  if (error) {
    console.error(error);
    throw new Error("Los trabajadores no pudieron cargarse");
  }

  return data;
}

export async function getWorkers() {
  const { data, error } = await supabase.from("workers").select("*");

  if (error) {
    console.error(error);
    throw new Error("Los trabajadores no pudieron cargarse");
  }

  return data;
}

export async function createEditWorkers(
  newWorker,
  id,
  {
    profilePictureFile = null,
    removeCurrentProfilePicture = false,
    currentProfilePicture = null,
    sustenancePlazas = [],
    dateOfAdmissions = [],
  } = {}
) {
  if (!newWorker || typeof newWorker !== "object")
    throw new Error("Los datos del trabajador no son válidos");
  if (!newWorker.name?.trim())
    throw new Error("El nombre del trabajador es requerido");
  if (!newWorker.RFC?.trim())
    throw new Error("El RFC del trabajador es requerido");
  const normalizedSustenancePlazas =
    normalizeSustenancePlazas(sustenancePlazas);
  validateSustenancePlazas(normalizedSustenancePlazas);

  let query = supabase.from("workers");
  let uploadedProfilePicture = null;
  const workerToSave = { ...newWorker };

  if (removeCurrentProfilePicture) workerToSave.profile_picture = null;

  if (profilePictureFile) {
    uploadedProfilePicture = await uploadProfilePicture(profilePictureFile);
    workerToSave.profile_picture = uploadedProfilePicture;
  }

  // A) CREATE
  if (!id) query = query.insert([workerToSave]);

  // B) EDIT
  if (id) query = query.update({ ...workerToSave }).eq("id", id);

  const { data, error } = await query.select().single();

  if (error) {
    if (uploadedProfilePicture) {
      try {
        await removeProfilePicture(uploadedProfilePicture);
      } catch (cleanupError) {
        console.error(cleanupError);
      }
    }

    console.error(error);
    throw new Error("El registro no pudo ser actualizado");
  }

  await replaceWorkerSustenancePlazas(data.id, normalizedSustenancePlazas);
  await replaceWorkerDateOfAdmissions(data.id, dateOfAdmissions);

  const shouldDeleteCurrentProfilePicture =
    currentProfilePicture &&
    (removeCurrentProfilePicture || uploadedProfilePicture) &&
    currentProfilePicture !== uploadedProfilePicture;

  if (shouldDeleteCurrentProfilePicture) {
    try {
      await removeProfilePicture(currentProfilePicture);
    } catch (cleanupError) {
      console.error(cleanupError);
    }
  }

  return data;
}
