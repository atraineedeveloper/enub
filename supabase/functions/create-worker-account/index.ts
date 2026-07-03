// create-worker-account
//
// Server-side provisioning of a worker's self-service Auth account by
// invitation. See specs/active/worker-self-service-documents/decisions.md
// (#21-#29) and implementation-plan.md §11.1 for the full design this
// implements.
//
// Request body: { workerId: number } -- ONLY. There is no `email` field and
// there must never be one: the worker's email always comes from
// public.workers.email (decisions.md #23, #29). The manual "Vincular cuenta
// existente" flow (the existing link_worker_account RPC, called directly
// from the app) remains the place a caller-supplied email belongs.
//
// Two Supabase clients:
// - userClient: forwards the caller's own Authorization header. Every read
//   (workers, profiles) and the link_worker_account RPC run through this
//   client, so they are authorized exactly like anywhere else in the app
//   (RLS, current_app_role()). This is the real security boundary for
//   "caller is not admin" -- link_worker_account rejects a non-admin caller
//   on its own, regardless of anything in this function.
// - adminClient: service role, used ONLY for auth.admin.inviteUserByEmail.
//   Never used to read or write workers/profiles directly -- that would
//   bypass RLS and duplicate authorization logic that already exists,
//   already-tested, in SQL (decisions.md #21).

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

// GoTrue's admin invite endpoint rejects an email that already has an
// account. That is expected here (case 2 -- existing Auth user), not a
// failure: this checks for that specific outcome so it can be distinguished
// from a real invite failure (case: unexpected Admin API error).
function isAlreadyRegisteredError(
  error: { message?: string; code?: string } | null,
): boolean {
  if (!error) return false;
  if (error.code === "email_exists") return true;
  const message = error.message?.toLowerCase() ?? "";
  return (
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("user already exists")
  );
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
  const redirectTo = Deno.env.get("WORKER_INVITE_REDIRECT_URL");

  // WORKER_INVITE_REDIRECT_URL is required here, alongside the other
  // required config, and checked before any request parsing or Auth Admin
  // API call -- inviteUserByEmail must never be called with an undefined
  // redirectTo (Codex review fix #2).
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !redirectTo) {
    console.error(
      "Missing required environment configuration: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / WORKER_INVITE_REDIRECT_URL",
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

  // Exact shape enforcement for decisions.md #29 (Codex review fix #1): the
  // body must contain exactly one key, "workerId" -- not "email", not
  // "worker_email"/"workerEmail", not any other extra field. Rejecting by
  // exact key-set, rather than checking for "email" specifically, closes
  // every variant of a caller-supplied-email workaround, not just the one
  // literal name.
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

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // Fast-fail UX only -- NOT the security boundary (decisions.md #24,
    // case 7). link_worker_account below enforces the real admin check
    // regardless of this result.
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
        "Solo un administrador puede crear cuentas de acceso",
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

    // Case 3: empty/null workers.email.
    const email = worker.email?.trim();
    if (!email) {
      return jsonError(
        400,
        "Este trabajador no tiene correo registrado; actualiza su correo antes de continuar",
      );
    }

    // Case 4: invalid format.
    if (!EMAIL_FORMAT_PATTERN.test(email)) {
      return jsonError(400, "El correo del trabajador no es válido");
    }

    // Case 5: duplicated across workers rows.
    const { count, error: duplicateCheckError } = await userClient
      .from("workers")
      .select("id", { count: "exact", head: true })
      .eq("email", email);

    if (duplicateCheckError) {
      console.error(duplicateCheckError);
      return jsonError(500, "No se pudo validar el correo del trabajador");
    }
    if ((count ?? 0) > 1) {
      return jsonError(
        400,
        "Este correo está registrado en más de un trabajador; corrige los datos antes de continuar",
      );
    }

    // Case 6: worker already has a linked profile. Checked before any
    // Admin API call so a repeat click never triggers a wasted invite.
    const { data: existingProfile, error: existingProfileError } =
      await userClient
        .from("profiles")
        .select("id")
        .eq("worker_id", workerId)
        .maybeSingle();

    if (existingProfileError) {
      console.error(existingProfileError);
      return jsonError(
        500,
        "No se pudo verificar si el trabajador ya tiene una cuenta vinculada",
      );
    }
    if (existingProfile) {
      return jsonSuccess({
        status: "already_linked",
        message: "El trabajador ya tiene una cuenta vinculada",
        workerId,
        email,
      });
    }

    // Cases 1/2: invite if new, treat "already registered" as expected
    // (not a failure) and proceed straight to linking either way. The
    // distinction is carried through to the response (Codex review fix #3)
    // so a caller can tell "we just invited someone new" apart from "this
    // email already had an account, we linked it" -- rather than one
    // generic success message for both.
    const { error: inviteError } = await adminClient.auth.admin
      .inviteUserByEmail(email, { redirectTo });

    let status: "invited" | "linked_existing_auth_user";
    if (inviteError) {
      if (!isAlreadyRegisteredError(inviteError)) {
        console.error(inviteError);
        return jsonError(502, "No se pudo invitar la cuenta; intenta de nuevo");
      }
      status = "linked_existing_auth_user";
    } else {
      status = "invited";
    }

    const { error: linkError } = await userClient.rpc("link_worker_account", {
      worker_id: workerId,
      worker_email: email,
    });

    if (linkError) {
      console.error(linkError);
      return jsonError(409, linkError.message);
    }

    const message = status === "invited"
      ? "Cuenta creada e invitación enviada"
      : "Cuenta Auth existente vinculada al trabajador";

    return jsonSuccess({ status, message, workerId, email });
  } catch (error) {
    console.error(error);
    return jsonError(500, "Ocurrió un error inesperado");
  }
});
