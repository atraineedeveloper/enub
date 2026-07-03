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

export async function linkWorkerAccount({ workerId, email }) {
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
async function extractFunctionErrorMessage(error) {
  try {
    if (error?.context && typeof error.context.json === "function") {
      const body = await error.context.json();
      if (body?.error) return body.error;
    }
  } catch (parseError) {
    console.error(parseError);
  }

  return error?.message || "No se pudo crear la cuenta de acceso";
}

// Request body is { workerId } only -- never an email (decisions.md #29).
// The Edge Function always resolves the worker's email from
// public.workers.email itself; this function must never accept or forward
// a caller-supplied email.
export async function createWorkerAccount({ workerId }) {
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
export async function resendWorkerAccessLink({ workerId }) {
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
