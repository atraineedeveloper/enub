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
// a caller-supplied email. It never touches auth.admin or service_role --
// those exist only inside the Edge Function's own server-side runtime.
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
