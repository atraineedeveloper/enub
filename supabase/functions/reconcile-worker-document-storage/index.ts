import { createClient } from "@supabase/supabase-js";

const WORKER_DOCUMENTS_BUCKET = "worker_documents";
const MAX_PATHS_PER_REQUEST = 20;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CleanupErrorCode =
  | "reference_check_failed"
  | "path_still_referenced"
  | "storage_exists_check_failed"
  | "storage_remove_failed"
  | "queue_update_failed";

interface CleanupEntry {
  id: number;
  storage_path: string;
  worker_id: number;
  attempt_count: number;
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function jsonError(status: number, message: string) {
  return jsonResponse(status, { error: message });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonError(405, "Método no permitido");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error(
      "Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY",
    );
    return jsonError(500, "El servidor no está configurado correctamente");
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return jsonError(401, "No autorizado");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Cuerpo de solicitud inválido");
  }

  const bodyKeys = Object.keys(body).sort();
  if (
    bodyKeys.length !== 2 ||
    bodyKeys[0] !== "storagePaths" ||
    bodyKeys[1] !== "workerId"
  ) {
    return jsonError(
      400,
      "El cuerpo debe contener únicamente workerId y storagePaths",
    );
  }

  const workerId = Number(body.workerId);
  if (!Number.isInteger(workerId) || workerId <= 0) {
    return jsonError(400, "workerId es requerido");
  }

  if (!Array.isArray(body.storagePaths)) {
    return jsonError(400, "storagePaths debe ser una lista");
  }

  const storagePaths = Array.from(
    new Set(
      body.storagePaths.filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0 && value.length <= 1024,
      ),
    ),
  );

  if (
    storagePaths.length === 0 ||
    storagePaths.length > MAX_PATHS_PER_REQUEST ||
    storagePaths.length !== body.storagePaths.length
  ) {
    return jsonError(400, "storagePaths contiene valores inválidos");
  }

  const workerPrefix = `${workerId}/`;
  if (storagePaths.some((path) => !path.startsWith(workerPrefix))) {
    return jsonError(400, "Las rutas no corresponden al trabajador indicado");
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: role, error: roleError } = await userClient.rpc(
    "current_app_role",
  );
  if (roleError) {
    console.error(roleError);
    return jsonError(500, "No se pudo verificar el rol del usuario");
  }

  if (!role || !["worker", "staff", "admin"].includes(role)) {
    return jsonError(403, "No autorizado para reconciliar documentos");
  }

  if (role === "worker") {
    const { data: currentWorkerId, error: workerError } = await userClient.rpc(
      "current_worker_id",
    );
    if (workerError) {
      console.error(workerError);
      return jsonError(500, "No se pudo verificar el trabajador actual");
    }
    if (Number(currentWorkerId) !== workerId) {
      return jsonError(403, "No autorizado para reconciliar este expediente");
    }
  }

  const { data: queuedRows, error: queueError } = await adminClient
    .from("worker_document_storage_cleanup_queue")
    .select("id, storage_path, worker_id, attempt_count")
    .eq("worker_id", workerId)
    .is("resolved_at", null)
    .in("storage_path", storagePaths);

  if (queueError) {
    console.error(queueError);
    return jsonError(500, "No se pudo cargar la cola de limpieza");
  }

  const entries = (queuedRows ?? []) as CleanupEntry[];
  let resolved = 0;
  let failed = 0;
  let conflicts = 0;

  async function recordFailure(entry: CleanupEntry, code: CleanupErrorCode) {
    const { error } = await adminClient
      .from("worker_document_storage_cleanup_queue")
      .update({
        attempt_count: entry.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
        last_error: code,
      })
      .eq("id", entry.id)
      .is("resolved_at", null);

    if (error) {
      console.error(error);
    }
  }

  async function recordResolved(entry: CleanupEntry) {
    const now = new Date().toISOString();
    const { error } = await adminClient
      .from("worker_document_storage_cleanup_queue")
      .update({
        attempt_count: entry.attempt_count + 1,
        last_attempt_at: now,
        last_error: null,
        resolved_at: now,
      })
      .eq("id", entry.id)
      .is("resolved_at", null);

    if (error) {
      console.error(error);
      await recordFailure(entry, "queue_update_failed");
      return false;
    }

    return true;
  }

  for (const entry of entries) {
    const { data: references, error: referenceError } = await adminClient
      .from("worker_documents")
      .select("id")
      .eq("storage_path", entry.storage_path)
      .limit(1);

    if (referenceError) {
      console.error(referenceError);
      failed += 1;
      await recordFailure(entry, "reference_check_failed");
      continue;
    }

    if ((references ?? []).length > 0) {
      conflicts += 1;
      await recordFailure(entry, "path_still_referenced");
      continue;
    }

    const { data: objectExists, error: existsError } = await adminClient.storage
      .from(WORKER_DOCUMENTS_BUCKET)
      .exists(entry.storage_path);

    if (existsError) {
      console.error(existsError);
      failed += 1;
      await recordFailure(entry, "storage_exists_check_failed");
      continue;
    }

    if (!objectExists) {
      if (await recordResolved(entry)) resolved += 1;
      else failed += 1;
      continue;
    }

    const { error: removeError } = await adminClient.storage
      .from(WORKER_DOCUMENTS_BUCKET)
      .remove([entry.storage_path]);

    if (removeError) {
      console.error(removeError);
      failed += 1;
      await recordFailure(entry, "storage_remove_failed");
      continue;
    }

    if (await recordResolved(entry)) resolved += 1;
    else failed += 1;
  }

  return jsonResponse(200, {
    requested: storagePaths.length,
    matched: entries.length,
    resolved,
    failed,
    conflicts,
  });
});
