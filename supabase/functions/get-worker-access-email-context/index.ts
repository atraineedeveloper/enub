// get-worker-access-email-context
//
// Browser-facing, read-only lookup used by the "Actualizar correo de
// acceso" confirmation dialog to display a worker's current linked Auth
// login email (masked by default, full only on explicit reveal) alongside
// the worker's display name. See
// openspec/changes/add-worker-access-email-correction/design.md §16 for
// the original closed contract, extended by the code-review revision
// (finding #5) so EVERY branch -- including method rejection, missing
// environment configuration, malformed input, role-RPC failure, and any
// unexpected database/RPC failure -- returns the same closed,
// discriminated ContextResponseBody shape. No branch ever returns an ad
// hoc `{ error: string }`.
//
// Distinct from the internal, snake_case, service-role-only
// get_worker_access_email_correction_context RPC (used by the sibling
// update-worker-access-email function, keyed by operation_id): this
// endpoint is keyed by workerId, has no notion of an operation, and never
// claims or mutates anything. It never returns an Auth user id, an
// operation identifier, or any other Auth metadata field, under either
// response shape.
//
// Two Supabase clients, same roles as update-worker-access-email:
// - userClient: forwards the caller's own Authorization header, used ONLY
//   for the current_app_role() admin check -- the real authorization
//   boundary.
// - adminClient: service role, used to resolve the worker/profile and to
//   read the linked Auth user's raw email via a worker-bound,
//   server-only RPC (get_linked_worker_auth_email_context -- code-review
//   finding #9: resolves linkage internally, exposing no arbitrary-UUID
//   lookup capability) -- never adminClient.auth.admin.getUserById.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MANUAL_ATTENTION_MESSAGE = "Revisión manual requerida";

// Every branch of this endpoint's response uses this one closed status
// union (code-review finding #5) -- the original seven business/auth
// reasonCodes (design.md §16) plus four infrastructure/request-validation
// outcomes.
export type ContextStatus =
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

interface ContextSuccessBody {
  status: "ok";
  workerId: number;
  workerName: string;
  email: string;
  revealed: boolean;
}

interface ContextErrorBody {
  status: Exclude<ContextStatus, "ok">;
  workerId: number | null;
  message?: string;
}

export type ContextResponseBody = ContextSuccessBody | ContextErrorBody;

const HTTP_STATUS_BY_STATUS: Record<ContextStatus, number> = {
  ok: 200,
  unauthorized: 401,
  forbidden: 403,
  invalid_request: 400,
  worker_not_found: 404,
  worker_not_linked: 409,
  invalid_profile_role: 500,
  linked_auth_user_missing: 500,
  method_not_allowed: 405,
  server_misconfigured: 500,
  internal_error: 500,
};

export interface HandlerDeps {
  getEnv: (name: string) => string | undefined;
  createUserClient: (
    url: string,
    anonKey: string,
    authorization: string,
  ) => SupabaseClient;
  createAdminClient: (url: string, serviceRoleKey: string) => SupabaseClient;
}

const defaultDeps: HandlerDeps = {
  getEnv: (name) => Deno.env.get(name),
  createUserClient: (url, anonKey, authorization) =>
    createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    }),
  createAdminClient: (url, serviceRoleKey) =>
    createClient(url, serviceRoleKey, { auth: { persistSession: false } }),
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function errorResponse(
  workerId: number | null,
  status: Exclude<ContextStatus, "ok">,
): Response {
  const body: ContextErrorBody = { status, workerId };
  if (status === "invalid_profile_role" || status === "linked_auth_user_missing") {
    body.message = MANUAL_ATTENTION_MESSAGE;
  }
  return jsonResponse(HTTP_STATUS_BY_STATUS[status], { ...body });
}

function successResponse(
  workerId: number,
  workerName: string,
  email: string,
  revealed: boolean,
): Response {
  const body: ContextSuccessBody = {
    status: "ok",
    workerId,
    workerName,
    email,
    revealed,
  };
  return jsonResponse(200, { ...body });
}

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) {
    return "•".repeat(Math.max(email.length, 1));
  }
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  const visible = local.slice(0, 1);
  return `${visible}${"•".repeat(Math.max(local.length - 1, 1))}${domain}`;
}

export async function handleRequest(
  req: Request,
  deps: HandlerDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return errorResponse(null, "method_not_allowed");
  }

  const supabaseUrl = deps.getEnv("SUPABASE_URL");
  const anonKey = deps.getEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = deps.getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error(
      "Missing required environment configuration: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY",
    );
    return errorResponse(null, "server_misconfigured");
  }

  // Authorization precedes parsing, same order as update-worker-access-email.
  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return errorResponse(null, "unauthorized");
  }

  const userClient = deps.createUserClient(supabaseUrl, anonKey, authorization);

  const { data: role, error: roleError } = await userClient.rpc(
    "current_app_role",
  );
  if (roleError) {
    console.error(roleError);
    return errorResponse(null, "internal_error");
  }
  if (role !== "admin") {
    return errorResponse(null, "forbidden");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(null, "invalid_request");
  }

  if (typeof body !== "object" || body === null) {
    return errorResponse(null, "invalid_request");
  }

  const bodyRecord = body as Record<string, unknown>;
  const bodyKeys = Object.keys(bodyRecord);
  const hasOnlyKnownKeys = bodyKeys.every(
    (key) => key === "workerId" || key === "reveal",
  );
  if (!hasOnlyKnownKeys || !("workerId" in bodyRecord)) {
    return errorResponse(null, "invalid_request");
  }

  const workerId = Number(bodyRecord.workerId);
  if (!Number.isInteger(workerId) || workerId <= 0) {
    return errorResponse(null, "invalid_request");
  }

  const reveal = bodyRecord.reveal;
  if (reveal !== undefined && typeof reveal !== "boolean") {
    return errorResponse(workerId, "invalid_request");
  }

  const adminClient = deps.createAdminClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: worker, error: workerError } = await adminClient
      .from("workers")
      .select("id, name")
      .eq("id", workerId)
      .maybeSingle();

    if (workerError) {
      console.error(workerError);
      return errorResponse(workerId, "internal_error");
    }
    if (!worker) {
      return errorResponse(workerId, "worker_not_found");
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("worker_id", workerId)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
      return errorResponse(workerId, "internal_error");
    }
    if (!profile) {
      return errorResponse(workerId, "worker_not_linked");
    }
    if (profile.role !== "worker") {
      return errorResponse(workerId, "invalid_profile_role");
    }

    // Code-review finding #9: a worker-bound RPC that resolves linkage
    // internally and returns only the one linked email -- no arbitrary
    // UUID lookup capability is ever exposed.
    const { data: authEmail, error: authEmailError } = await adminClient.rpc(
      "get_linked_worker_auth_email_context",
      { worker_id: workerId },
    );

    if (authEmailError) {
      console.error(authEmailError);
      return errorResponse(workerId, "linked_auth_user_missing");
    }
    if (!authEmail) {
      return errorResponse(workerId, "linked_auth_user_missing");
    }

    return successResponse(
      workerId,
      worker.name,
      reveal === true ? authEmail : maskEmail(authEmail as string),
      reveal === true,
    );
  } catch (error) {
    console.error(error);
    return errorResponse(workerId, "internal_error");
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleRequest(req));
}
