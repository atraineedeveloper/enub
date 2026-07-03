// resend-worker-access-link
//
// Server-side resend of a worker's password setup/recovery link, for a
// worker who ALREADY has a linked self-service account. See
// specs/active/worker-self-service-documents/decisions.md (#30-#34) and
// implementation-plan.md §12 for the full design this implements.
//
// This is a separate function from create-worker-account, not a branch
// inside it (decisions.md #30): the precondition here is the OPPOSITE of
// that function's case 6 -- this function requires a worker profile to
// ALREADY be linked (role = 'worker'), and rejects if it is not. It never
// creates an auth.users row, and never creates, updates, deletes, links, or
// unlinks any profiles row, under any code path.
//
// Request body: { workerId: number } -- ONLY. Same exact-shape enforcement
// as create-worker-account (decisions.md #29, extended by #33): the email
// always comes from public.workers.email, never from the request body.
//
// Two Supabase clients, both anon-key only -- this function never reads or
// uses SUPABASE_SERVICE_ROLE_KEY at all (decisions.md #32):
// - userClient: forwards the caller's own Authorization header. Used for
//   the admin check (current_app_role()), the workers.email read, and the
//   profiles linked-status read. This IS the real security boundary here
//   (decisions.md #34) -- current_app_role() is SECURITY DEFINER and
//   resolves the role from the caller's own verified JWT, not a
//   client-supplied claim, so a single call to it is sufficient (there is
//   no RPC equivalent to link_worker_account here to delegate to).
// - anonClient: plain anon-key client, no forwarded Authorization header --
//   used ONLY for resetPasswordForEmail, kept deliberately separate from
//   the admin's own authenticated client (decisions.md #32).

import { createClient } from "@supabase/supabase-js";

const EMAIL_FORMAT_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function jsonError(status: number, message: string) {
  return jsonResponse(status, { error: message });
}

function jsonSuccess(body: Record<string, unknown> = {}) {
  return jsonResponse(200, { ...body });
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
  const redirectTo = Deno.env.get("WORKER_INVITE_REDIRECT_URL");

  // WORKER_INVITE_REDIRECT_URL is required here, alongside the other
  // required config, and checked before any request parsing or Auth API
  // call -- resetPasswordForEmail must never be called with an undefined
  // redirectTo. Note: SUPABASE_SERVICE_ROLE_KEY is deliberately NOT read or
  // required by this function at all (decisions.md #32).
  if (!supabaseUrl || !anonKey || !redirectTo) {
    console.error(
      "Missing required environment configuration: SUPABASE_URL / SUPABASE_ANON_KEY / WORKER_INVITE_REDIRECT_URL",
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

  // Exact shape enforcement, same convention as create-worker-account
  // (decisions.md #29, #33): the body must contain exactly one key,
  // "workerId" -- not "email", not "worker_email"/"workerEmail", not any
  // other extra field.
  const bodyKeys = Object.keys(body);
  if (bodyKeys.length !== 1 || bodyKeys[0] !== "workerId") {
    return jsonError(
      400,
      "El cuerpo de la solicitud debe contener únicamente workerId.",
    );
  }

  const workerId = Number(body.workerId);
  if (!Number.isInteger(workerId) || workerId <= 0) {
    return jsonError(400, "workerId es requerido");
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  // No forwarded caller header -- used only for the public, anon-key-only
  // resetPasswordForEmail call, deliberately kept separate from the admin's
  // own authenticated session (decisions.md #32).
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  try {
    // This check IS the real security boundary here (decisions.md #34) --
    // unlike create-worker-account, there is no link_worker_account RPC to
    // delegate to. current_app_role() is SECURITY DEFINER and resolves from
    // the caller's own verified JWT, not a client-supplied claim, so a
    // single call is sufficient.
    const { data: role, error: roleError } = await userClient.rpc(
      "current_app_role",
    );
    if (roleError) {
      console.error(roleError);
      return jsonError(500, "No se pudo verificar el rol del usuario");
    }
    if (role !== "admin") {
      return jsonError(
        403,
        "Solo un administrador puede reenviar el enlace de acceso",
      );
    }

    const { data: worker, error: workerError } = await userClient
      .from("workers")
      .select("id, email")
      .eq("id", workerId)
      .maybeSingle();

    if (workerError) {
      console.error(workerError);
      return jsonError(500, "El trabajador no pudo cargarse");
    }
    if (!worker) {
      return jsonError(404, "Trabajador no encontrado");
    }

    const email = worker.email?.trim();
    if (!email) {
      return jsonError(
        400,
        "Este trabajador no tiene correo registrado; actualiza su correo antes de continuar",
      );
    }

    if (!EMAIL_FORMAT_PATTERN.test(email)) {
      return jsonError(400, "El correo del trabajador no es válido");
    }

    // Precondition is the OPPOSITE of create-worker-account's case 6
    // (decisions.md #33): this function requires an EXISTING linked worker
    // profile, and never creates one. No auth.users row is ever created or
    // touched here, no profiles row is ever created, updated, or deleted.
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("id, role")
      .eq("worker_id", workerId)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
      return jsonError(
        500,
        "No se pudo verificar si el trabajador tiene una cuenta vinculada",
      );
    }
    if (!profile || profile.role !== "worker") {
      return jsonError(
        409,
        "Este trabajador no tiene una cuenta vinculada todavía; usa 'Crear cuenta de acceso' primero",
      );
    }

    // GoTrue's resetPasswordForEmail already returns a uniform response
    // regardless of whether the target address has a matching auth.users
    // row, preventing email enumeration -- this function relies on that
    // built-in behavior rather than re-implementing it (decisions.md #33).
    const { error: resendError } = await anonClient.auth.resetPasswordForEmail(
      email,
      { redirectTo },
    );

    if (resendError) {
      console.error(resendError);
      return jsonError(502, "No se pudo reenviar el enlace; intenta de nuevo");
    }

    return jsonSuccess({
      status: "access_link_sent",
      message: "Enlace de acceso reenviado",
      workerId,
      email,
    });
  } catch (error) {
    console.error(error);
    return jsonError(500, "Ocurrió un error inesperado");
  }
});
