import supabase from "./supabase";

const PROFILE_PICTURES_BUCKET = "profile_pictures";

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
  } = {}
) {
  // 1. Create/edit State Role
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
