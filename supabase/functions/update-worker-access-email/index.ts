// update-worker-access-email
//
// Server-side correction of a worker's linked Auth login email, for a
// worker who ALREADY has a linked self-service account. See
// openspec/changes/add-worker-access-email-correction/design.md for the
// full design this implements, including the code-review revision that
// added: pre-mutation linkage revalidation, external-Auth-drift guarding,
// honest transition-uncertainty re-observation, a fully closed response
// contract (including infrastructure/request failures), and typed-only
// Auth-error classification.
//
// This function NEVER creates a new Auth user and NEVER deletes one --
// it only calls updateUserById on the worker's existing, already-linked
// Auth user. It never sends any email itself: the existing, separate
// "Reenviar enlace de acceso" action (resend-worker-access-link) is how an
// administrator delivers a fresh access message afterward. Do not add an
// invitation, password-reset, or Auth-user deletion call here (see the
// sibling create-worker-account / resend-worker-access-link functions for
// those, which this change does not modify).
//
// Request body: { workerId: number, newEmail: string } -- exactly. The
// browser never supplies the linked Auth user id, the current Auth email,
// the linked profile id, or service-role credentials; every one of those
// is resolved and verified server-side, inside the internal RPCs this
// function calls.
//
// Two Supabase clients:
// - userClient: forwards the caller's own Authorization header, used ONLY
//   for the current_app_role() admin check. This IS the real
//   authorization boundary -- none of the internal RPCs below perform
//   their own admin check: they are service-role-only and unreachable
//   from any authenticated session directly.
// - adminClient: service role, used for every internal RPC call (claim,
//   operation-context, identity revalidation, the operation-bound Auth
//   email read, the canonical Auth-match lookup, sync, both transitions)
//   and for the one Auth Admin API write, updateUserById.
//
// Every response -- including every infrastructure/request-validation
// failure -- uses the ONE closed CorrectionResponseBody shape (never an
// ad hoc { error: string }). workerId is null only when no valid worker
// id could be parsed from the request.

import {
  createClient,
  isAuthApiError,
  type AuthApiError,
  type SupabaseClient,
} from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MANUAL_ATTENTION_MESSAGE = "Revisión manual requerida";

// The seven reason codes mark_worker_access_email_correction_manual_attention
// itself accepts (design.md §9, extended by code-review finding #2) -- any
// other value is rejected by that RPC.
type ManualAttentionReasonCode =
  | "ambiguous_claim_state"
  | "duplicate_worker_email"
  | "linkage_changed"
  | "operation_identity_mismatch"
  | "external_auth_email_changed"
  | "auth_update_uncertain"
  | "worker_sync_uncertain";

// The six-value result of validate_worker_access_email_correction_identity
// (code-review finding #1).
type IdentityValidationResult =
  | "valid"
  | "worker_not_found"
  | "linkage_changed"
  | "operation_identity_mismatch"
  | "linked_auth_user_missing"
  | "operation_not_active";

export type CorrectionStatus =
  // Business outcomes (design.md §11/§13).
  | "updated"
  | "already_synchronized"
  | "correction_already_in_progress"
  | "manual_attention_required"
  | "worker_not_found"
  | "worker_not_linked"
  | "invalid_profile_role"
  | "linked_auth_user_missing"
  | "invalid_email"
  | "duplicate_worker_email"
  | "email_owned_by_another_auth_user"
  | "multiple_canonical_auth_matches"
  | "auth_update_failed"
  | "auth_update_uncertain"
  | "worker_sync_failed"
  | "worker_sync_uncertain"
  // Infrastructure/request-validation outcomes (code-review finding #4) --
  // every response uses this same closed contract, never an ad hoc
  // { error: string }.
  | "method_not_allowed"
  | "unauthorized"
  | "forbidden"
  | "invalid_request"
  | "server_misconfigured"
  | "internal_error";

export type CorrectionReasonCode =
  | "updated"
  | "already_synchronized"
  | "different_target_in_progress"
  | "manual_attention_blocking"
  | "ambiguous_claim_state"
  | "duplicate_worker_email"
  | "linkage_changed"
  | "operation_identity_mismatch"
  | "external_auth_email_changed"
  | "worker_not_found"
  | "worker_not_linked"
  | "invalid_profile_role"
  | "linked_auth_user_missing"
  | "invalid_email"
  | "email_owned_by_another_auth_user"
  | "multiple_canonical_auth_matches"
  | "auth_update_failed"
  | "auth_update_uncertain"
  | "stale_worker_edit"
  | "worker_sync_uncertain"
  | "method_not_allowed"
  | "unauthorized"
  | "forbidden"
  | "invalid_request"
  | "server_misconfigured"
  | "internal_error";

export interface CorrectionResponseBody {
  workerId: number | null;
  status: CorrectionStatus;
  reasonCode: CorrectionReasonCode;
  retryable: boolean;
  emailSynchronized: boolean;
  message?: string;
}

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

interface OutcomeSpec {
  httpStatus: number;
  retryable: boolean;
  emailSynchronized: boolean;
  message?: string;
}

// design.md §13's complete, literal response table, extended by
// code-review finding #4 with infrastructure/request-validation
// outcomes. manual_attention_required's own HTTP code depends on its
// reasonCode (409 only for manual_attention_blocking; 500 for every
// other reason), so it is handled as its own switch case rather than a
// flat per-status table.
function resolveOutcomeSpec(
  status: CorrectionStatus,
  reasonCode: CorrectionReasonCode,
): OutcomeSpec {
  switch (status) {
    case "manual_attention_required":
      return {
        httpStatus: reasonCode === "manual_attention_blocking" ? 409 : 500,
        retryable: false,
        emailSynchronized: false,
        message: MANUAL_ATTENTION_MESSAGE,
      };
    case "worker_not_found":
      return { httpStatus: 404, retryable: false, emailSynchronized: false };
    case "worker_not_linked":
      return { httpStatus: 409, retryable: false, emailSynchronized: false };
    case "invalid_profile_role":
      return {
        httpStatus: 500,
        retryable: false,
        emailSynchronized: false,
        message: MANUAL_ATTENTION_MESSAGE,
      };
    case "linked_auth_user_missing":
      return {
        httpStatus: 500,
        retryable: false,
        emailSynchronized: false,
        message: MANUAL_ATTENTION_MESSAGE,
      };
    case "invalid_email":
      return { httpStatus: 400, retryable: false, emailSynchronized: false };
    case "duplicate_worker_email":
      return { httpStatus: 409, retryable: false, emailSynchronized: false };
    case "correction_already_in_progress":
      return { httpStatus: 409, retryable: false, emailSynchronized: false };
    case "already_synchronized":
      return { httpStatus: 200, retryable: false, emailSynchronized: true };
    case "updated":
      return { httpStatus: 200, retryable: false, emailSynchronized: true };
    case "auth_update_failed":
      return { httpStatus: 502, retryable: true, emailSynchronized: false };
    case "auth_update_uncertain":
      return { httpStatus: 500, retryable: true, emailSynchronized: false };
    // Genuinely 200 (design.md §13 row 15): a stale-guard rejection is a
    // normal, expected, safely-retryable outcome, not a server error.
    case "worker_sync_failed":
      return { httpStatus: 200, retryable: true, emailSynchronized: false };
    case "worker_sync_uncertain":
      return { httpStatus: 500, retryable: true, emailSynchronized: false };
    case "email_owned_by_another_auth_user":
      return { httpStatus: 409, retryable: false, emailSynchronized: false };
    case "multiple_canonical_auth_matches":
      return { httpStatus: 409, retryable: false, emailSynchronized: false };
    case "method_not_allowed":
      return { httpStatus: 405, retryable: false, emailSynchronized: false };
    case "unauthorized":
      return { httpStatus: 401, retryable: false, emailSynchronized: false };
    case "forbidden":
      return { httpStatus: 403, retryable: false, emailSynchronized: false };
    case "invalid_request":
      return { httpStatus: 400, retryable: false, emailSynchronized: false };
    case "server_misconfigured":
      return { httpStatus: 500, retryable: false, emailSynchronized: false };
    case "internal_error":
      return { httpStatus: 500, retryable: false, emailSynchronized: false };
  }
}

function correctionResponse(
  workerId: number | null,
  status: CorrectionStatus,
  reasonCode: CorrectionReasonCode,
): Response {
  const spec = resolveOutcomeSpec(status, reasonCode);
  const body: CorrectionResponseBody = {
    workerId,
    status,
    reasonCode,
    retryable: spec.retryable,
    emailSynchronized: spec.emailSynchronized,
    ...(spec.message ? { message: spec.message } : {}),
  };
  return jsonResponse(spec.httpStatus, { ...body });
}

interface OperationContext {
  operationId: number;
  workerId: number;
  linkedAuthUserId: string;
  requestedCanonicalEmail: string;
}

interface FinalOutcome {
  status: CorrectionStatus;
  reasonCode: CorrectionReasonCode;
}

function canonicalize(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length === 0 ? null : trimmed;
}

async function loadOperationContext(
  adminClient: SupabaseClient,
  operationId: number,
): Promise<OperationContext> {
  const { data, error } = await adminClient.rpc(
    "get_worker_access_email_correction_context",
    { p_operation_id: operationId },
  );
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<
    string,
    unknown
  >;
  return {
    operationId: row.operation_id as number,
    workerId: row.worker_id as number,
    linkedAuthUserId: row.linked_auth_user_id as string,
    requestedCanonicalEmail: row.requested_canonical_email as string,
  };
}

async function readWorkerEmail(
  adminClient: SupabaseClient,
  workerId: number,
): Promise<string | null> {
  const { data, error } = await adminClient
    .from("workers")
    .select("email")
    .eq("id", workerId)
    .maybeSingle();
  if (error) throw error;
  return (data?.email as string | null | undefined) ?? null;
}

// The only reliable way to detect zero/one/multiple canonical Auth
// matches -- never adminClient.auth.admin.getUserById for pure
// comparison (design.md §2).
async function lookupCanonicalAuthMatches(
  adminClient: SupabaseClient,
  canonicalEmail: string,
): Promise<string[]> {
  const { data, error } = await adminClient.rpc(
    "find_auth_users_by_canonical_email",
    { raw_email: canonicalEmail },
  );
  if (error) throw error;
  return (data as string[] | null) ?? [];
}

// Code-review finding #1: revalidate the operation's own recorded
// linkage/identity immediately before every Auth mutation attempt. Never
// trusts the claim-time or context-time resolution alone.
async function validateOperationIdentity(
  adminClient: SupabaseClient,
  operationId: number,
): Promise<IdentityValidationResult> {
  const { data, error } = await adminClient.rpc(
    "validate_worker_access_email_correction_identity",
    { p_operation_id: operationId },
  );
  if (error) throw error;
  return data as IdentityValidationResult;
}

// Code-review finding #9: an operation-bound raw Auth email read,
// replacing the general-purpose UUID lookup for this flow's own reads.
// Used both for the reconciliation-start baseline and the fresh,
// immediately-before-the-write re-read the external-Auth-drift guard
// (finding #2) needs.
async function readOperationAuthEmail(
  adminClient: SupabaseClient,
  operationId: number,
): Promise<string | null> {
  const { data, error } = await adminClient.rpc(
    "get_worker_access_email_correction_auth_email",
    { p_operation_id: operationId },
  );
  if (error) throw error;
  return data as string | null;
}

// Code-review finding #6: classify a genuine Auth email-conflict ONLY via
// an official typed guard (isAuthApiError) plus a stable, recognized
// code. Never infer a conflict from an English message fragment -- if no
// stable recognized code is present, this returns false and the caller
// falls through to the generic failed/uncertain classification instead.
function isRecognizedEmailConflict(error: unknown): boolean {
  if (!isAuthApiError(error)) return false;
  const authError = error as AuthApiError;
  return authError.code === "email_exists";
}

type AuthUpdateOutcome =
  | { kind: "already_matches" }
  | { kind: "owned_by_other" }
  | { kind: "multiple_matches" }
  | { kind: "updated" }
  | { kind: "failed" }
  | { kind: "uncertain" }
  // Code-review findings #1/#2: the pre-mutation gate itself rejected the
  // attempt -- no Auth mutation of any kind was attempted.
  | {
    kind: "identity_invalid";
    result: Exclude<IdentityValidationResult, "valid">;
  }
  | { kind: "external_drift" };

// Code-review findings #1 and #2, combined: immediately before ever
// calling updateUserById, (a) revalidate the operation's own recorded
// identity fresh, and (b) freshly re-read the Auth user's current raw
// email and compare it against both the requested target and the
// baseline observed at the start of this reconciliation attempt --
// never blindly overwriting an unrelated third email introduced
// externally after the operation was created.
async function attemptAuthUpdate(
  adminClient: SupabaseClient,
  context: OperationContext,
  authEmailAtReconciliationStart: string | null,
): Promise<AuthUpdateOutcome> {
  const identityResult = await validateOperationIdentity(
    adminClient,
    context.operationId,
  );
  if (identityResult !== "valid") {
    return { kind: "identity_invalid", result: identityResult };
  }

  const freshAuthEmail = await readOperationAuthEmail(
    adminClient,
    context.operationId,
  );
  const freshCanonical = canonicalize(freshAuthEmail);

  if (freshCanonical === context.requestedCanonicalEmail) {
    // Auth already equals the target -- someone else converged it since
    // reconciliation began. No mutation needed.
    return { kind: "already_matches" };
  }

  if (freshCanonical !== canonicalize(authEmailAtReconciliationStart)) {
    // Auth changed to a THIRD, unrelated email after this reconciliation
    // attempt started -- never overwrite it blindly.
    return { kind: "external_drift" };
  }

  // Unchanged since the start of this reconciliation attempt: safe to
  // proceed with the zero/one/multiple canonical-match check and the
  // actual write.
  const matches = await lookupCanonicalAuthMatches(
    adminClient,
    context.requestedCanonicalEmail,
  );
  if (matches.includes(context.linkedAuthUserId)) {
    return { kind: "already_matches" };
  }
  if (matches.length === 1) {
    return { kind: "owned_by_other" };
  }
  if (matches.length > 1) {
    return { kind: "multiple_matches" };
  }

  const { error } = await adminClient.auth.admin.updateUserById(
    context.linkedAuthUserId,
    { email: context.requestedCanonicalEmail, email_confirm: true },
  );

  if (!error) {
    return { kind: "updated" };
  }

  if (isRecognizedEmailConflict(error)) {
    return { kind: "owned_by_other" };
  }

  // Any other confirmed AuthApiError, or an unconfirmed/timeout-shaped
  // error: never classify by an English message fragment or a naked
  // `.code` check -- a fresh direct-SQL re-read decides between
  // "definitely failed" and "genuinely uncertain."
  const rechecked = await lookupCanonicalAuthMatches(
    adminClient,
    context.requestedCanonicalEmail,
  );
  if (rechecked.includes(context.linkedAuthUserId)) {
    return { kind: "updated" };
  }
  return isAuthApiError(error) ? { kind: "failed" } : { kind: "uncertain" };
}

type SyncOutcome =
  | { kind: "converged" }
  | { kind: "sync_failed_stale" }
  | {
    kind: "manual_attention";
    reasonCode: Extract<
      ManualAttentionReasonCode,
      "duplicate_worker_email" | "linkage_changed" | "operation_identity_mismatch"
    >;
  }
  | { kind: "worker_not_found" }
  | { kind: "uncertain" };

async function runSync(
  adminClient: SupabaseClient,
  operationId: number,
  workerId: number,
  requestedCanonicalEmail: string,
): Promise<SyncOutcome> {
  const { data, error } = await adminClient.rpc(
    "sync_worker_email_after_access_correction",
    { operation_id: operationId },
  );

  if (error) {
    const currentEmail = await readWorkerEmail(adminClient, workerId);
    return canonicalize(currentEmail) === requestedCanonicalEmail
      ? { kind: "converged" }
      : { kind: "uncertain" };
  }

  switch (data as string) {
    case "updated":
    case "already_current":
      return { kind: "converged" };
    case "stale_worker_edit": {
      const currentEmail = await readWorkerEmail(adminClient, workerId);
      return canonicalize(currentEmail) === requestedCanonicalEmail
        ? { kind: "converged" }
        : { kind: "sync_failed_stale" };
    }
    case "duplicate_worker_email":
      return { kind: "manual_attention", reasonCode: "duplicate_worker_email" };
    case "linkage_changed":
      return { kind: "manual_attention", reasonCode: "linkage_changed" };
    case "operation_identity_mismatch":
      return {
        kind: "manual_attention",
        reasonCode: "operation_identity_mismatch",
      };
    case "worker_not_found":
      return { kind: "worker_not_found" };
    default:
      // operation_not_active or any unrecognized value: never assumed --
      // treated as uncertain so the caller re-observes via the context RPC.
      return { kind: "uncertain" };
  }
}

// Code-review finding #3: re-reads the durable operation through the
// context RPC, plus fresh worker/Auth state, before concluding anything
// -- never derives a final status from an unobserved timeout, and never
// assumes a particular transition landed just because it was attempted.
async function reobserveOperation(
  adminClient: SupabaseClient,
  context: OperationContext,
  uncertainSource: Extract<
    ManualAttentionReasonCode,
    "auth_update_uncertain" | "worker_sync_uncertain"
  >,
): Promise<FinalOutcome> {
  const { data, error } = await adminClient.rpc(
    "get_worker_access_email_correction_context",
    { p_operation_id: context.operationId },
  );

  if (!error) {
    const row = (Array.isArray(data) ? data[0] : data) as
      | Record<string, unknown>
      | undefined;

    if (row?.state === "completed") {
      return { status: "updated", reasonCode: "updated" };
    }

    if (row?.state === "manual_attention_required") {
      const reasonCode = (row.last_reason_code as CorrectionReasonCode) ??
        uncertainSource;
      return { status: "manual_attention_required", reasonCode };
    }

    if (row?.state === "active") {
      const [currentWorkerEmail, authMatchesList] = await Promise.all([
        readWorkerEmail(adminClient, context.workerId),
        lookupCanonicalAuthMatches(
          adminClient,
          context.requestedCanonicalEmail,
        ),
      ]);
      const workerMatches =
        canonicalize(currentWorkerEmail) === context.requestedCanonicalEmail;
      const authAlreadyMatches = authMatchesList.includes(
        context.linkedAuthUserId,
      );

      if (workerMatches && authAlreadyMatches) {
        // Genuinely converged, but the completion transition has not
        // landed yet: report the matching retryable-uncertain status
        // rather than a success this response has not itself confirmed.
        return { status: uncertainSource, reasonCode: uncertainSource };
      }
    }
  }

  // Nothing above could be established: transition to
  // manual_attention_required as a final, safe fallback -- routed
  // through the same honest, self-verifying helper as every other
  // transition attempt (never assumed to have landed without a re-read).
  return transitionToManualAttention(adminClient, context, uncertainSource);
}

// Code-review finding #3: never return manual_attention_required merely
// because this function attempted the transition. Always re-reads the
// durable operation afterward and reports only what that re-read
// actually shows -- regardless of whether the RPC call itself appeared
// to succeed or error.
async function transitionToManualAttention(
  adminClient: SupabaseClient,
  context: OperationContext,
  reasonCode: ManualAttentionReasonCode,
): Promise<FinalOutcome> {
  await adminClient.rpc("mark_worker_access_email_correction_manual_attention", {
    p_operation_id: context.operationId,
    p_reason_code: reasonCode,
  });

  const { data, error } = await adminClient.rpc(
    "get_worker_access_email_correction_context",
    { p_operation_id: context.operationId },
  );

  if (!error) {
    const row = (Array.isArray(data) ? data[0] : data) as
      | Record<string, unknown>
      | undefined;

    if (row?.state === "manual_attention_required") {
      const observedReason = (row.last_reason_code as CorrectionReasonCode) ??
        reasonCode;
      return { status: "manual_attention_required", reasonCode: observedReason };
    }

    if (row?.state === "completed") {
      // Converged via some other path in the interim -- report success,
      // never a stale manual-attention claim the re-read contradicts.
      return { status: "updated", reasonCode: "updated" };
    }

    if (row?.state === "active") {
      // The transition did not (yet) land -- safely resumable, a
      // retryable uncertainty, never a false manual_attention_required
      // claim.
      const uncertainSource: Extract<
        ManualAttentionReasonCode,
        "auth_update_uncertain" | "worker_sync_uncertain"
      > = reasonCode === "auth_update_uncertain"
        ? "auth_update_uncertain"
        : "worker_sync_uncertain";
      return { status: uncertainSource, reasonCode: uncertainSource };
    }
  }

  // Durable state could not be observed at all -- closed uncertainty,
  // without claiming any particular transition landed.
  return { status: "worker_sync_uncertain", reasonCode: "worker_sync_uncertain" };
}

async function attemptCompletion(
  adminClient: SupabaseClient,
  context: OperationContext,
  uncertainSource: Extract<
    ManualAttentionReasonCode,
    "auth_update_uncertain" | "worker_sync_uncertain"
  >,
): Promise<FinalOutcome> {
  const { data, error } = await adminClient.rpc(
    "mark_worker_access_email_correction_completed",
    { p_operation_id: context.operationId },
  );

  if (error) {
    return reobserveOperation(adminClient, context, uncertainSource);
  }

  if (data === true) {
    // The completion RPC's own independent re-check confirmed
    // convergence -- a trustworthy, authoritative boolean, not merely
    // "the call didn't throw."
    return { status: "updated", reasonCode: "updated" };
  }

  // The completion RPC's own independent re-check found the sides do not
  // (yet) genuinely converge -- never trust a caller-asserted "it worked."
  return { status: uncertainSource, reasonCode: uncertainSource };
}

async function resolveSyncOutcome(
  adminClient: SupabaseClient,
  context: OperationContext,
  outcome: SyncOutcome,
): Promise<FinalOutcome> {
  switch (outcome.kind) {
    case "converged":
      return attemptCompletion(adminClient, context, "worker_sync_uncertain");
    case "sync_failed_stale":
      return { status: "worker_sync_failed", reasonCode: "stale_worker_edit" };
    case "worker_not_found":
      return { status: "worker_not_found", reasonCode: "worker_not_found" };
    case "manual_attention":
      return transitionToManualAttention(
        adminClient,
        context,
        outcome.reasonCode,
      );
    case "uncertain":
      return reobserveOperation(adminClient, context, "worker_sync_uncertain");
  }
}

async function resolveAuthUpdateOutcome(
  adminClient: SupabaseClient,
  context: OperationContext,
  outcome: AuthUpdateOutcome,
  alsoNeedsSync: boolean,
): Promise<FinalOutcome> {
  switch (outcome.kind) {
    case "identity_invalid": {
      const identityResult = outcome.result;
      switch (identityResult) {
        case "worker_not_found":
          return { status: "worker_not_found", reasonCode: "worker_not_found" };
        case "linked_auth_user_missing":
          return {
            status: "linked_auth_user_missing",
            reasonCode: "linked_auth_user_missing",
          };
        case "operation_not_active":
          return reobserveOperation(
            adminClient,
            context,
            "worker_sync_uncertain",
          );
        case "linkage_changed":
        case "operation_identity_mismatch":
          return transitionToManualAttention(
            adminClient,
            context,
            identityResult,
          );
      }
      break;
    }
    case "external_drift":
      return transitionToManualAttention(
        adminClient,
        context,
        "external_auth_email_changed",
      );
    case "owned_by_other":
      return {
        status: "email_owned_by_another_auth_user",
        reasonCode: "email_owned_by_another_auth_user",
      };
    case "multiple_matches":
      return {
        status: "multiple_canonical_auth_matches",
        reasonCode: "multiple_canonical_auth_matches",
      };
    case "failed":
      return { status: "auth_update_failed", reasonCode: "auth_update_failed" };
    case "uncertain":
      return reobserveOperation(adminClient, context, "auth_update_uncertain");
    case "already_matches":
    case "updated":
      if (alsoNeedsSync) {
        const syncOutcome = await runSync(
          adminClient,
          context.operationId,
          context.workerId,
          context.requestedCanonicalEmail,
        );
        return resolveSyncOutcome(adminClient, context, syncOutcome);
      }
      return attemptCompletion(adminClient, context, "auth_update_uncertain");
  }
}

interface ClaimRow {
  operation_id: number | null;
  outcome: string;
  reason_code: string | null;
}

export async function handleRequest(
  req: Request,
  deps: HandlerDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return correctionResponse(null, "method_not_allowed", "method_not_allowed");
  }

  const supabaseUrl = deps.getEnv("SUPABASE_URL");
  const anonKey = deps.getEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = deps.getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error(
      "Missing required environment configuration: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY",
    );
    return correctionResponse(
      null,
      "server_misconfigured",
      "server_misconfigured",
    );
  }

  // Authorization precedes parsing: (b) required env, (c) bearer
  // presence, (d) admin check, all before (e) req.json() is ever called.
  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return correctionResponse(null, "unauthorized", "unauthorized");
  }

  const userClient = deps.createUserClient(supabaseUrl, anonKey, authorization);

  const { data: role, error: roleError } = await userClient.rpc(
    "current_app_role",
  );
  if (roleError) {
    console.error(roleError);
    return correctionResponse(null, "internal_error", "internal_error");
  }
  if (role !== "admin") {
    return correctionResponse(null, "forbidden", "forbidden");
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return correctionResponse(null, "invalid_request", "invalid_request");
  }

  const bodyKeys = Object.keys(body);
  if (
    bodyKeys.length !== 2 ||
    !bodyKeys.includes("workerId") ||
    !bodyKeys.includes("newEmail")
  ) {
    return correctionResponse(null, "invalid_request", "invalid_request");
  }

  const workerId = Number(body.workerId);
  if (!Number.isInteger(workerId) || workerId <= 0) {
    return correctionResponse(null, "invalid_request", "invalid_request");
  }

  const newEmail = body.newEmail;
  if (typeof newEmail !== "string" || newEmail.trim() === "") {
    return correctionResponse(workerId, "invalid_request", "invalid_request");
  }

  const adminClient = deps.createAdminClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: claimRows, error: claimError } = await adminClient.rpc(
      "claim_worker_access_email_correction",
      { worker_id: workerId, requested_email: newEmail },
    );

    if (claimError) {
      if (claimError.code === "WAEC1") {
        return correctionResponse(workerId, "invalid_email", "invalid_email");
      }
      console.error(claimError);
      return correctionResponse(workerId, "internal_error", "internal_error");
    }

    const claim = (Array.isArray(claimRows) ? claimRows[0] : claimRows) as
      | ClaimRow
      | undefined;

    if (!claim) {
      console.error("claim_worker_access_email_correction returned no row");
      return correctionResponse(workerId, "internal_error", "internal_error");
    }

    switch (claim.outcome) {
      case "worker_not_found":
        return correctionResponse(
          workerId,
          "worker_not_found",
          "worker_not_found",
        );
      case "worker_not_linked":
        return correctionResponse(
          workerId,
          "worker_not_linked",
          "worker_not_linked",
        );
      case "invalid_profile_role":
        return correctionResponse(
          workerId,
          "invalid_profile_role",
          "invalid_profile_role",
        );
      case "linked_auth_user_missing":
        return correctionResponse(
          workerId,
          "linked_auth_user_missing",
          "linked_auth_user_missing",
        );
      case "duplicate_worker_email":
        return correctionResponse(
          workerId,
          "duplicate_worker_email",
          "duplicate_worker_email",
        );
      case "different_target_in_progress":
        return correctionResponse(
          workerId,
          "correction_already_in_progress",
          "different_target_in_progress",
        );
      case "manual_attention_blocking":
        return correctionResponse(
          workerId,
          "manual_attention_required",
          "manual_attention_blocking",
        );
      case "ambiguous_claim_state":
        return correctionResponse(
          workerId,
          "manual_attention_required",
          "ambiguous_claim_state",
        );
      case "already_completed":
        // No further RPC call of any kind for this outcome.
        return correctionResponse(
          workerId,
          "already_synchronized",
          "already_synchronized",
        );
      case "created":
      case "resumed":
        break;
      default:
        console.error("Unexpected claim outcome:", claim.outcome);
        return correctionResponse(workerId, "internal_error", "internal_error");
    }

    if (claim.operation_id === null || claim.operation_id === undefined) {
      console.error("Missing operation_id for outcome:", claim.outcome);
      return correctionResponse(workerId, "internal_error", "internal_error");
    }

    // Bind every subsequent step to the claim's own operation context --
    // never a second, independently-re-run resolution of worker/profile/
    // Auth identity.
    const context = await loadOperationContext(
      adminClient,
      claim.operation_id,
    );

    const currentWorkerEmail = await readWorkerEmail(
      adminClient,
      context.workerId,
    );
    const workerMatches =
      canonicalize(currentWorkerEmail) === context.requestedCanonicalEmail;

    // Code-review finding #2: the baseline Auth email observed at the
    // start of THIS reconciliation attempt -- compared later, immediately
    // before any write, against a fresh re-read to detect external drift.
    const authEmailAtReconciliationStart = await readOperationAuthEmail(
      adminClient,
      context.operationId,
    );
    const authMatches =
      canonicalize(authEmailAtReconciliationStart) ===
        context.requestedCanonicalEmail;

    let finalOutcome: FinalOutcome;

    if (authMatches && workerMatches) {
      finalOutcome = await attemptCompletion(
        adminClient,
        context,
        "worker_sync_uncertain",
      );
    } else if (authMatches && !workerMatches) {
      const syncOutcome = await runSync(
        adminClient,
        context.operationId,
        context.workerId,
        context.requestedCanonicalEmail,
      );
      finalOutcome = await resolveSyncOutcome(adminClient, context, syncOutcome);
    } else {
      const updateOutcome = await attemptAuthUpdate(
        adminClient,
        context,
        authEmailAtReconciliationStart,
      );
      finalOutcome = await resolveAuthUpdateOutcome(
        adminClient,
        context,
        updateOutcome,
        /* alsoNeedsSync */ !workerMatches,
      );
    }

    return correctionResponse(
      workerId,
      finalOutcome.status,
      finalOutcome.reasonCode,
    );
  } catch (error) {
    console.error(error);
    return correctionResponse(workerId, "internal_error", "internal_error");
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleRequest(req));
}
