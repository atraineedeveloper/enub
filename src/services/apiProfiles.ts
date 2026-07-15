import supabase from "./supabase";

export async function getCurrentProfile() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return { role: null, workerId: null };

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!userData?.user) return { role: null, workerId: null };

  const { data, error } = await supabase
    .from("profiles")
    .select("role, worker_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("El perfil del usuario no pudo cargarse");
  }

  return {
    role: data?.role ?? null,
    workerId: data?.worker_id ?? null,
  };
}

// Minimal data needed to know which workers already have a linked
// self-service account, so the admin UI can show the right action per row
// (Crear cuenta de acceso / Reenviar enlace de acceso / Vincular cuenta
// existente) instead of guessing from workers.email. Only worker_id is
// selected -- no Auth user data (email, id, etc.) is exposed here. RLS
// ("Admins can read all profiles") means a non-admin caller simply gets an
// empty list back, not an error.
export async function getLinkedWorkerIds() {
  const { data, error } = await supabase
    .from("profiles")
    .select("worker_id")
    .eq("role", "worker");

  if (error) {
    console.error(error);
    throw new Error(
      "No se pudo verificar qué trabajadores ya tienen cuenta vinculada"
    );
  }

  return data.map((row) => row.worker_id);
}

export async function linkWorkerAccount({
  workerId,
  email,
}: {
  workerId: number;
  email: string;
}) {
  const { error } = await supabase.rpc("link_worker_account", {
    worker_id: workerId,
    worker_email: email,
  });

  // The RPC's own exception message is the user-facing content here (e.g.
  // "No auth account found for ...", "This account already has role staff
  // and cannot be linked as a worker; ..."), not a generic fallback — those
  // messages are the point, per decisions.md #16.
  if (error) {
    console.error(error);
    throw new Error(error.message);
  }
}

// supabase.functions.invoke() only exposes a generic "Edge Function returned
// a non-2xx status code" message by default; the function's own JSON body
// (the actual { error: "..." } this app cares about, e.g. "Este trabajador
// no tiene correo registrado...") is on error.context, a Response object
// that has to be parsed separately.
async function parseFunctionErrorBody(error: {
  context?: { json?: () => Promise<Record<string, unknown>> };
  message?: string;
} | null): Promise<Record<string, unknown> | null> {
  try {
    if (error?.context && typeof error.context.json === "function") {
      return await error.context.json();
    }
  } catch (parseError) {
    console.error(parseError);
  }
  return null;
}

async function extractFunctionErrorMessage(error: {
  context?: { json?: () => Promise<{ error?: string }> };
  message?: string;
}) {
  const body = await parseFunctionErrorBody(error);
  if (body?.error) return body.error as string;
  return error?.message || "No se pudo crear la cuenta de acceso";
}

// Request body is { workerId } only -- never an email (decisions.md #29).
// The Edge Function always resolves the worker's email from
// public.workers.email itself; this function must never accept or forward
// a caller-supplied email.
export async function createWorkerAccount({ workerId }: { workerId: number }) {
  const { data, error } = await supabase.functions.invoke(
    "create-worker-account",
    { body: { workerId } }
  );

  if (error) {
    const message = await extractFunctionErrorMessage(error);
    throw new Error(message);
  }

  return data;
}

// Request body is { workerId } only -- same convention as createWorkerAccount
// (decisions.md #29, extended by #33). This is a separate action for a
// worker who already has a linked account (decisions.md #30): it never
// creates or links a profile.
export async function resendWorkerAccessLink({
  workerId,
}: {
  workerId: number;
}) {
  const { data, error } = await supabase.functions.invoke(
    "resend-worker-access-link",
    { body: { workerId } }
  );

  if (error) {
    const message = await extractFunctionErrorMessage(error);
    throw new Error(message);
  }

  return data;
}

// The closed response contract for update-worker-access-email
// (code-review revision): every branch, including infrastructure/request
// failures, returns this one shape. workerId is null only when no valid
// worker id could be parsed from the request. No operationId, no Auth
// user id, no delivery field, under any outcome.
export interface WorkerAccessEmailCorrectionResult {
  workerId: number | null;
  status: string;
  reasonCode: string;
  retryable: boolean;
  emailSynchronized: boolean;
  message?: string;
}

// Request body is { workerId, newEmail } only -- the browser never
// supplies the linked Auth user id, the current Auth email, the profile
// id, or service-role credentials (design.md, add-worker-access-email-
// correction). Unlike createWorkerAccount/resendWorkerAccessLink, most of
// this endpoint's "expected" outcomes (worker_not_found, invalid_email,
// correction_already_in_progress, manual_attention_required, ...) are
// deliberately returned as non-2xx HTTP responses that are still part of
// the closed, documented contract -- this function must never throw for
// those; it only throws for a genuinely unexpected, non-contract error
// shape (e.g. missing server configuration).
export async function updateWorkerAccessEmail({
  workerId,
  newEmail,
}: {
  workerId: number;
  newEmail: string;
}): Promise<WorkerAccessEmailCorrectionResult> {
  const { data, error } = await supabase.functions.invoke(
    "update-worker-access-email",
    { body: { workerId, newEmail } }
  );

  if (!error) {
    return data as WorkerAccessEmailCorrectionResult;
  }

  const body = await parseFunctionErrorBody(error);
  if (body && typeof body.status === "string") {
    return body as unknown as WorkerAccessEmailCorrectionResult;
  }

  throw new Error(
    (body?.error as string | undefined) ||
      error.message ||
      "No se pudo actualizar el correo de acceso"
  );
}

// The closed, discriminated response contract for the browser-facing
// context lookup (design.md §16, extended by the code-review revision so
// every branch -- including infrastructure/request failures -- returns
// this one shape). `status: "ok"` is the only shape with `workerName`/
// `email`/`revealed`; every other status is an error, distinguished by
// `status` alone. Never an Auth user id or operation identifier, under
// either shape.
export type WorkerAccessEmailContextStatus =
  | "ok"
  | "unauthorized"
  | "forbidden"
  | "invalid_request"
  | "worker_not_found"
  | "worker_not_linked"
  | "invalid_profile_role"
  | "linked_auth_user_missing"
  | "method_not_allowed"
  | "server_misconfigured"
  | "internal_error";

export interface WorkerAccessEmailContextResult {
  status: WorkerAccessEmailContextStatus;
  workerId: number | null;
  workerName?: string;
  email?: string;
  revealed?: boolean;
  message?: string;
}

// This function never throws for the closed contract's own error
// statuses -- callers branch on `result.status` (finding #5), the same
// convention updateWorkerAccessEmail already follows. It only throws for
// a genuinely unparseable transport-level failure with no JSON body at
// all (e.g. a network error before any response was received).
export async function getWorkerAccessEmailContext({
  workerId,
  reveal,
}: {
  workerId: number;
  reveal?: boolean;
}): Promise<WorkerAccessEmailContextResult> {
  const { data, error } = await supabase.functions.invoke(
    "get-worker-access-email-context",
    { body: reveal === undefined ? { workerId } : { workerId, reveal } }
  );

  if (!error) {
    return data as WorkerAccessEmailContextResult;
  }

  const body = await parseFunctionErrorBody(error);
  if (body && typeof body.status === "string") {
    return body as unknown as WorkerAccessEmailContextResult;
  }

  throw new Error(error.message || "No se pudo cargar el correo de acceso");
}
