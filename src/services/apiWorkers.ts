import supabase from "./supabase";
import type { Database, Json } from "../types/supabase";
import { createWorkerUpdateError } from "./workerUpdateErrors";

type WorkerUpdate = Database["public"]["Tables"]["workers"]["Update"];

const PROFILE_PICTURES_BUCKET = "profile_pictures";
const ALLOWED_SUSTENANCE_TYPES = new Set(["Estatal", "Federal"]);

function normalizeSustenanceType(value: string = "") {
  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === "estatal") return "Estatal";
  if (normalizedValue === "federal") return "Federal";
  return value.trim();
}

function getFileExtension(fileName: string = "") {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "jpg";
}

function createProfilePictureName(file: File) {
  const extension = getFileExtension(file?.name);
  return `worker-${crypto.randomUUID()}.${extension}`;
}

async function uploadProfilePicture(file: File) {
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

async function removeProfilePicture(fileName?: string | null) {
  if (!fileName) return;

  const { error } = await supabase.storage
    .from(PROFILE_PICTURES_BUCKET)
    .remove([fileName]);

  if (error) throw error;
}

interface SustenancePlazaInput {
  sustenance?: string;
  payment_key?: string;
  plaza?: string;
}

function normalizeSustenancePlazas(sustenancePlazas: SustenancePlazaInput[] = []) {
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

function validateSustenancePlazas(
  sustenancePlazas: { sustenance: string; payment_key: string; plaza: string }[] = []
) {
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

interface DateOfAdmissionInput {
  type?: string | null;
  date_of_admission?: string | null;
}

async function replaceWorkerDateOfAdmissions(
  workerId: number,
  dateOfAdmissions: DateOfAdmissionInput[] = []
) {
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

async function replaceWorkerSustenancePlazas(
  workerId: number,
  sustenancePlazas: { sustenance: string; payment_key: string; plaza: string }[] = []
) {
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

export function getProfilePicturePublicUrl(fileName?: string | null) {
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

export async function getWorkerById(id: number) {
  const { data, error } = await supabase
    .from("workers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error(error);
    throw new Error("El trabajador no pudo cargarse");
  }

  return data;
}

export interface WorkerIdentityRow {
  name: string | null;
  profile_picture: string | null;
}

// Scoped to the authenticated-header identity path only -- uses
// .maybeSingle() (not .single()) so a missing row resolves to `data: null`
// with no thrown error, distinguishable from a genuine transport/RLS/db
// failure (which still throws below). getWorkerById() above is left
// unchanged for its existing callers, which correctly want a throw when a
// specific worker id doesn't exist.
export async function getWorkerIdentityById(
  id: number
): Promise<WorkerIdentityRow | null> {
  const { data, error } = await supabase
    .from("workers")
    .select("name, profile_picture")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("El perfil del trabajador no pudo cargarse");
  }

  return data;
}

export interface MySustenancePlaza {
  sustenance: string | null;
  payment_key: string | null;
  plaza: string | null;
}

export interface MyDateOfAdmission {
  type: string | null;
  date_of_admission: string | null;
}

export interface MyWorkerProfile {
  name: string | null;
  RFC: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  neighborhood: string | null;
  post_code: string | null;
  city: string | null;
  state: string | null;
  type_worker: string | null;
  specialty: string | null;
  function_performed: string | null;
  status: number | null;
  profile_picture: string | null;
  sustenance_plazas: MySustenancePlaza[];
  date_of_admissions: MyDateOfAdmission[];
}

// Backs the read-only "Mi información" self-service page. The explicit
// column list (and the explicit, narrow column list on each embedded
// relation) is a request/UI minimization -- it keeps the network payload
// and the frontend's data model limited to exactly what that page renders
// (observations, id, worker_id, created_at, and every other technical
// metadata column are deliberately never requested here, on `workers` or
// on either relation) -- it is NOT a database-level column confidentiality
// boundary. `workers` row-level security ("Workers can read own worker
// row") authorizes the *row*, not individual columns: a worker's own
// authenticated client remains capable of requesting every column of
// their own row directly, regardless of this projection. True column-level
// confidentiality (a restricted view or a SECURITY INVOKER function with a
// database-enforced allow-list) is tracked as a separate follow-up, not
// delivered by this function.
//
// sustenance_plazas/date_of_admissions are embedded via PostgREST's nested
// resource syntax, never fetched with a second/third query and never
// filtered by an explicit `worker_id` on the client's part: authorization
// for both relations is enforced independently by their own RLS SELECT
// policies (worker_id = current_worker_id(), see
// 20260721000000_worker_relation_ownership_select_policies.sql) -- the
// same principle already established for the schedule/profile queries
// (the client never supplies a worker id as an authorization input). No
// RPC is used here: both relations are already a straight, RLS-protected
// read of rows related by foreign key, so a SECURITY INVOKER function
// would rely on the exact same row policies for no added guarantee.
//
// Same .maybeSingle() missing-row-vs-error handling as
// getWorkerIdentityById() above.
export async function getMyWorkerProfile(
  id: number
): Promise<MyWorkerProfile | null> {
  const { data, error } = await supabase
    .from("workers")
    .select(
      "name, RFC, email, phone, street, neighborhood, post_code, city, state, " +
        "type_worker, specialty, function_performed, status, profile_picture, " +
        "sustenance_plazas(sustenance, payment_key, plaza), " +
        "date_of_admissions(type, date_of_admission)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("La información no pudo cargarse");
  }

  return data as MyWorkerProfile | null;
}

interface CreateEditWorkerOptions {
  profilePictureFile?: File | null;
  removeCurrentProfilePicture?: boolean;
  currentProfilePicture?: string | null;
  sustenancePlazas?: SustenancePlazaInput[];
  dateOfAdmissions?: DateOfAdmissionInput[];
}

export async function createEditWorkers(
  newWorker: Record<string, unknown>,
  id?: number,
  {
    profilePictureFile = null,
    removeCurrentProfilePicture = false,
    currentProfilePicture = null,
    sustenancePlazas,
    dateOfAdmissions,
  }: CreateEditWorkerOptions = {}
) {
  if (!newWorker || typeof newWorker !== "object")
    throw new Error("Los datos del trabajador no son válidos");
  if (!(newWorker.name as string | undefined)?.trim())
    throw new Error("El nombre del trabajador es requerido");
  if (!(newWorker.RFC as string | undefined)?.trim())
    throw new Error("El RFC del trabajador es requerido");
  const normalizedSustenancePlazas = normalizeSustenancePlazas(
    sustenancePlazas ?? []
  );
  if (sustenancePlazas !== undefined) {
    validateSustenancePlazas(normalizedSustenancePlazas);
  }

  let uploadedProfilePicture: string | null = null;
  const workerToSave: Record<string, unknown> = { ...newWorker };

  if (removeCurrentProfilePicture) workerToSave.profile_picture = null;

  if (profilePictureFile) {
    uploadedProfilePicture = await uploadProfilePicture(profilePictureFile);
    workerToSave.profile_picture = uploadedProfilePicture;
  }

  const query = id
    ? supabase
        .rpc("update_worker_with_relations", {
          p_worker_id: id,
          p_worker: workerToSave as Json,
          p_sustenance_plazas:
            sustenancePlazas === undefined ? undefined : normalizedSustenancePlazas,
          p_date_of_admissions:
            dateOfAdmissions === undefined
              ? undefined
              : (dateOfAdmissions as Json),
        })
        .single()
    : supabase
        .from("workers")
        .insert([workerToSave as WorkerUpdate])
        .select()
        .single();

  const { data, error } = await query;

  if (error) {
    if (uploadedProfilePicture) {
      try {
        await removeProfilePicture(uploadedProfilePicture);
      } catch (cleanupError) {
        console.error(cleanupError);
      }
    }

    if (id) throw createWorkerUpdateError(error);

    console.error(error);
    throw new Error("El registro no pudo ser actualizado");
  }

  if (!id) {
    await replaceWorkerSustenancePlazas(data.id, normalizedSustenancePlazas);
    await replaceWorkerDateOfAdmissions(data.id, dateOfAdmissions ?? []);
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
