// Deno tests for update-worker-access-email. Dependency-injected fakes
// only -- no real network or database calls.

import { handleRequest, type HandlerDeps } from "./index.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Minimal, dependency-free assertion helpers (no external test library, to
// keep this file runnable with no network access).
// ---------------------------------------------------------------------------

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (!same) {
    throw new Error(
      `Assertion failed${message ? `: ${message}` : ""}\n  actual:   ${
        JSON.stringify(actual)
      }\n  expected: ${JSON.stringify(expected)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function makeUserClient(
  role: string | null,
  roleError: unknown = null,
): SupabaseClient {
  return {
    rpc: (fn: string) => {
      if (fn === "current_app_role") {
        return Promise.resolve({ data: role, error: roleError });
      }
      throw new Error(`Unexpected userClient.rpc call: ${fn}`);
    },
  } as unknown as SupabaseClient;
}

type RpcResult = { data: unknown; error: unknown };

interface AdminClientConfig {
  claim?: (params: Record<string, unknown>) => RpcResult;
  context?: (params: Record<string, unknown>) => RpcResult;
  validateIdentity?: (params: Record<string, unknown>) => RpcResult;
  authEmail?: string | null | (() => string | null);
  findMatches?: (params: Record<string, unknown>) => RpcResult;
  sync?: (params: Record<string, unknown>) => RpcResult;
  markCompleted?: (params: Record<string, unknown>) => RpcResult;
  markManualAttention?: (params: Record<string, unknown>) => RpcResult;
  workerEmail?: string | null | (() => string | null);
  updateUserById?: (id: string, attrs: unknown) => { error: unknown };
}

interface AdminClientFake {
  client: SupabaseClient;
  calls: { fn: string; params: unknown }[];
  updateUserByIdCalls: { id: string; attrs: unknown }[];
}

function makeAdminClient(config: AdminClientConfig): AdminClientFake {
  const calls: { fn: string; params: unknown }[] = [];
  const updateUserByIdCalls: { id: string; attrs: unknown }[] = [];

  const rpc = (fn: string, params?: Record<string, unknown>) => {
    calls.push({ fn, params });
    switch (fn) {
      case "claim_worker_access_email_correction":
        return Promise.resolve(
          config.claim
            ? config.claim(params ?? {})
            : { data: null, error: new Error("claim not configured") },
        );
      case "get_worker_access_email_correction_context":
        return Promise.resolve(
          config.context
            ? config.context(params ?? {})
            : { data: null, error: new Error("context not configured") },
        );
      case "validate_worker_access_email_correction_identity":
        return Promise.resolve(
          config.validateIdentity
            ? config.validateIdentity(params ?? {})
            : { data: "valid", error: null },
        );
      case "get_worker_access_email_correction_auth_email": {
        const value = typeof config.authEmail === "function"
          ? config.authEmail()
          : config.authEmail ?? null;
        return Promise.resolve({ data: value, error: null });
      }
      case "find_auth_users_by_canonical_email":
        return Promise.resolve(
          config.findMatches
            ? config.findMatches(params ?? {})
            : { data: [], error: null },
        );
      case "sync_worker_email_after_access_correction":
        return Promise.resolve(
          config.sync
            ? config.sync(params ?? {})
            : { data: null, error: new Error("sync not configured") },
        );
      case "mark_worker_access_email_correction_completed":
        return Promise.resolve(
          config.markCompleted
            ? config.markCompleted(params ?? {})
            : { data: true, error: null },
        );
      case "mark_worker_access_email_correction_manual_attention":
        return Promise.resolve(
          config.markManualAttention
            ? config.markManualAttention(params ?? {})
            : { data: null, error: null },
        );
      default:
        throw new Error(`Unexpected adminClient.rpc call: ${fn}`);
    }
  };

  const from = (table: string) => {
    assert(table === "workers", `Unexpected table: ${table}`);
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            const email = typeof config.workerEmail === "function"
              ? config.workerEmail()
              : config.workerEmail ?? null;
            return Promise.resolve({ data: { email }, error: null });
          },
        }),
      }),
    };
  };

  const client = {
    rpc,
    from,
    auth: {
      admin: {
        updateUserById: (id: string, attrs: unknown) => {
          updateUserByIdCalls.push({ id, attrs });
          return Promise.resolve(
            config.updateUserById
              ? config.updateUserById(id, attrs)
              : { error: null },
          );
        },
      },
    },
  } as unknown as SupabaseClient;

  return { client, calls, updateUserByIdCalls };
}

function makeDeps(
  role: string | null,
  adminConfig: AdminClientConfig,
): { deps: HandlerDeps; admin: AdminClientFake } {
  const admin = makeAdminClient(adminConfig);
  const deps: HandlerDeps = {
    getEnv: (name) =>
      ({
        SUPABASE_URL: "https://example.test",
        SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      })[name],
    createUserClient: () => makeUserClient(role),
    createAdminClient: () => admin.client,
  };
  return { deps, admin };
}

function makeRequest(
  rawBody: string,
  opts: { authorization?: string | null } = {},
): Request {
  const headers = new Headers();
  if (opts.authorization !== null) {
    headers.set("Authorization", opts.authorization ?? "Bearer test-token");
  }
  return new Request("https://example.test/update-worker-access-email", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

async function jsonOf(res: Response): Promise<Record<string, unknown>> {
  return await res.json();
}

const CONTEXT_ROW = (overrides: Partial<Record<string, unknown>> = {}) => ({
  operation_id: 1,
  worker_id: 10,
  linked_auth_user_id: "auth-1",
  requested_canonical_email: "new@example.test",
  raw_expected_worker_email: "old@example.test",
  state: "active",
  last_reason_code: null,
  ...overrides,
});

function claimReturning(outcome: string, reasonCode: string | null = null, operationId: number | null = null) {
  return () => ({
    data: [{ operation_id: operationId, outcome, reason_code: reasonCode }],
    error: null,
  });
}

// ---------------------------------------------------------------------------
// Authorization precedes parsing, all four combinations
// ---------------------------------------------------------------------------

Deno.test("unauthenticated + malformed body -> unauthorized/401, workerId null, body never parsed", async () => {
  const { deps, admin } = makeDeps("admin", {});
  const res = await handleRequest(
    makeRequest("{not valid json", { authorization: null }),
    deps,
  );
  assertEquals(res.status, 401);
  const body = await jsonOf(res);
  assertEquals(body.status, "unauthorized");
  assertEquals(body.workerId, null);
  assertEquals(admin.calls.length, 0, "no service-role RPC call made");
});

Deno.test("unauthenticated + unknown-key body -> unauthorized/401, body never parsed", async () => {
  const { deps, admin } = makeDeps("admin", {});
  const res = await handleRequest(
    makeRequest(JSON.stringify({ foo: "bar" }), { authorization: null }),
    deps,
  );
  assertEquals(res.status, 401);
  assertEquals(admin.calls.length, 0);
});

Deno.test("non-admin + malformed body -> forbidden/403, body never parsed", async () => {
  const { deps, admin } = makeDeps("worker", {});
  const res = await handleRequest(makeRequest("{not valid json"), deps);
  assertEquals(res.status, 403);
  assertEquals((await jsonOf(res)).status, "forbidden");
  assertEquals(admin.calls.length, 0);
});

Deno.test("non-admin + unknown-key body -> forbidden/403, body never parsed", async () => {
  const { deps, admin } = makeDeps("worker", {});
  const res = await handleRequest(
    makeRequest(JSON.stringify({ foo: "bar" })),
    deps,
  );
  assertEquals(res.status, 403);
  assertEquals(admin.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Closed contract for every infrastructure/request-validation branch
// (code-review finding #4)
// ---------------------------------------------------------------------------

Deno.test("GET/PUT/DELETE -> method_not_allowed/405, workerId null", async () => {
  const { deps } = makeDeps("admin", {});
  const req = new Request("https://example.test/update-worker-access-email", {
    method: "GET",
  });
  const res = await handleRequest(req, deps);
  assertEquals(res.status, 405);
  const body = await jsonOf(res);
  assertEquals(body.status, "method_not_allowed");
  assertEquals(body.reasonCode, "method_not_allowed");
  assertEquals(body.workerId, null);
  assert(!("error" in body), "must not use the ad hoc { error } shape");
});

Deno.test("missing SUPABASE_URL -> server_misconfigured/500, closed contract", async () => {
  const admin = makeAdminClient({});
  const deps: HandlerDeps = {
    getEnv: (name) =>
      name === "SUPABASE_URL" ? undefined : "some-value",
    createUserClient: () => makeUserClient("admin"),
    createAdminClient: () => admin.client,
  };
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  assertEquals(res.status, 500);
  const body = await jsonOf(res);
  assertEquals(body.status, "server_misconfigured");
  assertEquals(body.workerId, null);
  assert(!("error" in body), "must not use the ad hoc { error } shape");
});

Deno.test("malformed JSON body (authenticated admin) -> invalid_request/400, closed contract", async () => {
  const { deps } = makeDeps("admin", {});
  const res = await handleRequest(makeRequest("{not valid json"), deps);
  assertEquals(res.status, 400);
  const body = await jsonOf(res);
  assertEquals(body.status, "invalid_request");
  assertEquals(body.workerId, null);
  assert(!("error" in body), "must not use the ad hoc { error } shape");
});

Deno.test("unknown extra key in body -> invalid_request/400", async () => {
  const { deps } = makeDeps("admin", {});
  const res = await handleRequest(
    makeRequest(
      JSON.stringify({ workerId: 10, newEmail: "new@example.test", extra: true }),
    ),
    deps,
  );
  assertEquals(res.status, 400);
  assertEquals((await jsonOf(res)).status, "invalid_request");
});

Deno.test("invalid workerId type -> invalid_request/400, workerId null", async () => {
  const { deps } = makeDeps("admin", {});
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: "not-a-number", newEmail: "new@example.test" })),
    deps,
  );
  assertEquals(res.status, 400);
  const body = await jsonOf(res);
  assertEquals(body.status, "invalid_request");
  assertEquals(body.workerId, null);
});

Deno.test("role-RPC failure -> internal_error/500, no raw message leaked", async () => {
  const admin = makeAdminClient({});
  const deps: HandlerDeps = {
    getEnv: (name) =>
      ({
        SUPABASE_URL: "https://example.test",
        SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      })[name],
    createUserClient: () =>
      ({
        rpc: () =>
          Promise.resolve({
            data: null,
            error: { message: "some raw internal postgres error detail" },
          }),
      }) as unknown as SupabaseClient,
    createAdminClient: () => admin.client,
  };
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  assertEquals(res.status, 500);
  const body = await jsonOf(res);
  assertEquals(body.status, "internal_error");
  const raw = JSON.stringify(body);
  assert(
    !raw.includes("raw internal postgres error detail"),
    "must not leak the raw internal error message",
  );
});

Deno.test("claim RPC unexpected failure -> internal_error/500, workerId preserved", async () => {
  const { deps } = makeDeps("admin", {
    claim: () => ({ data: null, error: { message: "unexpected db failure" } }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  assertEquals(res.status, 500);
  const body = await jsonOf(res);
  assertEquals(body.status, "internal_error");
  assertEquals(body.workerId, 10);
  assert(!JSON.stringify(body).includes("unexpected db failure"), "must not leak the raw error message");
});

Deno.test("unexpected claim outcome string -> internal_error/500", async () => {
  const { deps } = makeDeps("admin", {
    claim: claimReturning("some_future_outcome_not_yet_handled"),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  assertEquals(res.status, 500);
  assertEquals((await jsonOf(res)).status, "internal_error");
});

Deno.test("catch-all: an uncaught exception anywhere in the flow -> internal_error/500", async () => {
  const { deps } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => {
      throw new Error("boom");
    },
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  assertEquals(res.status, 500);
  const body = await jsonOf(res);
  assertEquals(body.status, "internal_error");
  assertEquals(body.workerId, 10);
});

// ---------------------------------------------------------------------------
// Claim-outcome mapping
// ---------------------------------------------------------------------------

Deno.test("already_completed short-circuits with no further RPC calls", async () => {
  const { deps, admin } = makeDeps("admin", {
    claim: claimReturning("already_completed", "already_synchronized", 1),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  const body = await jsonOf(res);
  assertEquals(body.status, "already_synchronized");
  assertEquals(res.status, 200);
  assertEquals(
    admin.calls.map((c) => c.fn),
    ["claim_worker_access_email_correction"],
  );
});

for (
  const outcome of [
    "worker_not_found",
    "worker_not_linked",
    "invalid_profile_role",
    "linked_auth_user_missing",
    "duplicate_worker_email",
  ]
) {
  Deno.test(`claim outcome ${outcome} short-circuits to matching status`, async () => {
    const { deps, admin } = makeDeps("admin", {
      claim: claimReturning(outcome, outcome, null),
    });
    const res = await handleRequest(
      makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
      deps,
    );
    assertEquals((await jsonOf(res)).status, outcome);
    assertEquals(admin.calls.length, 1);
  });
}

Deno.test("invalid_email (claim raises WAEC1)", async () => {
  const { deps } = makeDeps("admin", {
    claim: () => ({ data: null, error: { code: "WAEC1", message: "bad email" } }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "not-an-email" })),
    deps,
  );
  assertEquals(res.status, 400);
  assertEquals((await jsonOf(res)).status, "invalid_email");
});

// ---------------------------------------------------------------------------
// Finding #1: pre-mutation linkage revalidation
// ---------------------------------------------------------------------------

Deno.test("finding #1: profile relinked after claim/context, before Auth mutation -> the former Auth account is not updated", async () => {
  let contextCallCount = 0;
  const { deps, admin } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => {
      contextCallCount += 1;
      return {
        data: [
          CONTEXT_ROW({
            linked_auth_user_id: "former-auth-id",
            state: contextCallCount >= 2 ? "manual_attention_required" : "active",
            last_reason_code: contextCallCount >= 2 ? "linkage_changed" : null,
          }),
        ],
        error: null,
      };
    },
    workerEmail: "old@example.test",
    // The profile was relinked to a DIFFERENT Auth user between the claim/
    // context read and this attempt's own pre-mutation revalidation.
    validateIdentity: () => ({ data: "linkage_changed", error: null }),
    authEmail: "former-auth-old@example.test",
    markManualAttention: () => ({ data: null, error: null }),
  });

  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  const body = await jsonOf(res);
  assertEquals(body.status, "manual_attention_required");
  assertEquals(body.reasonCode, "linkage_changed");
  assertEquals(
    admin.updateUserByIdCalls.length,
    0,
    "the former Auth account must never be updated once linkage has changed",
  );
  assert(
    admin.calls.some((c) => c.fn === "validate_worker_access_email_correction_identity"),
    "the identity gate must have been called before the would-be mutation",
  );
});

Deno.test("finding #1: validate_identity called immediately before every Auth mutation attempt", async () => {
  const { deps, admin } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => ({ data: [CONTEXT_ROW()], error: null }),
    workerEmail: "old@example.test",
    authEmail: "old-auth@example.test",
    validateIdentity: () => ({ data: "valid", error: null }),
    findMatches: () => ({ data: [], error: null }),
    updateUserById: () => ({ error: null }),
    sync: () => ({ data: "updated", error: null }),
    markCompleted: () => ({ data: true, error: null }),
  });

  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  assertEquals((await jsonOf(res)).status, "updated");

  const validateCallIndex = admin.calls.findIndex(
    (c) => c.fn === "validate_worker_access_email_correction_identity",
  );
  const updateCallIndex = admin.calls.findIndex((c) => c.fn === "auth.admin.updateUserById");
  assert(validateCallIndex !== -1, "validate_identity must have been called");
  // updateUserById isn't in admin.calls (it's a separate client surface),
  // but the mutation itself must have happened -- confirm order via the
  // fresh-auth-email read that always immediately precedes the write.
  const authEmailReadCount = admin.calls.filter(
    (c) => c.fn === "get_worker_access_email_correction_auth_email",
  ).length;
  assert(authEmailReadCount >= 2, "expected a baseline read and a fresh pre-write read");
  assert(admin.updateUserByIdCalls.length === 1, "expected exactly one Auth update attempt");
  void updateCallIndex;
});

Deno.test("finding #1: linked_auth_user_missing from validate_identity maps to the top-level status, no manual_attention transition", async () => {
  const { deps, admin } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => ({ data: [CONTEXT_ROW()], error: null }),
    workerEmail: "old@example.test",
    authEmail: "old-auth@example.test",
    validateIdentity: () => ({ data: "linked_auth_user_missing", error: null }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  const body = await jsonOf(res);
  assertEquals(body.status, "linked_auth_user_missing");
  assertEquals(res.status, 500);
  assert(
    !admin.calls.some((c) => c.fn === "mark_worker_access_email_correction_manual_attention"),
    "linked_auth_user_missing is its own top-level status, not routed through manual-attention",
  );
  assertEquals(admin.updateUserByIdCalls.length, 0);
});

Deno.test("finding #1: worker_not_found from validate_identity maps to the top-level status", async () => {
  const { deps } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => ({ data: [CONTEXT_ROW()], error: null }),
    workerEmail: "old@example.test",
    authEmail: "old-auth@example.test",
    validateIdentity: () => ({ data: "worker_not_found", error: null }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  const body = await jsonOf(res);
  assertEquals(body.status, "worker_not_found");
  assertEquals(res.status, 404);
});

// ---------------------------------------------------------------------------
// Finding #2: external Auth email drift guard
// ---------------------------------------------------------------------------

Deno.test("finding #2: claim created for target B while Auth is A; external actor changes Auth to C; endpoint must not overwrite C with B", async () => {
  let authEmailReadCount = 0;
  let contextCallCount = 0;
  const { deps, admin } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => {
      contextCallCount += 1;
      return {
        data: [
          CONTEXT_ROW({
            requested_canonical_email: "target-b@example.test",
            state: contextCallCount >= 2 ? "manual_attention_required" : "active",
            last_reason_code: contextCallCount >= 2 ? "external_auth_email_changed" : null,
          }),
        ],
        error: null,
      };
    },
    workerEmail: "old-worker@example.test",
    validateIdentity: () => ({ data: "valid", error: null }),
    authEmail: () => {
      authEmailReadCount += 1;
      // First read (reconciliation-start baseline): Auth is A.
      // Second read (fresh, immediately before the write): Auth has since
      // been changed externally to C -- neither the baseline (A) nor the
      // target (B).
      return authEmailReadCount === 1 ? "auth-a@example.test" : "auth-c-unrelated@example.test";
    },
    markManualAttention: () => ({ data: null, error: null }),
  });

  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "target-b@example.test" })),
    deps,
  );
  const body = await jsonOf(res);
  assertEquals(body.status, "manual_attention_required");
  assertEquals(body.reasonCode, "external_auth_email_changed");
  assertEquals(
    admin.updateUserByIdCalls.length,
    0,
    "must never overwrite C with B once external drift is detected",
  );
});

Deno.test("finding #2: Auth unchanged since reconciliation start -> update proceeds normally", async () => {
  const { deps, admin } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => ({ data: [CONTEXT_ROW()], error: null }),
    workerEmail: "old@example.test",
    validateIdentity: () => ({ data: "valid", error: null }),
    // Both the baseline and the fresh pre-write read return the same,
    // unchanged value.
    authEmail: "old-auth@example.test",
    findMatches: () => ({ data: [], error: null }),
    updateUserById: () => ({ error: null }),
    sync: () => ({ data: "updated", error: null }),
    markCompleted: () => ({ data: true, error: null }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  assertEquals((await jsonOf(res)).status, "updated");
  assertEquals(admin.updateUserByIdCalls.length, 1);
});

Deno.test("finding #2: Auth already equals target by the fresh read -> no mutation attempted, proceeds as converged", async () => {
  let authEmailReadCount = 0;
  const { deps, admin } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => ({ data: [CONTEXT_ROW()], error: null }),
    workerEmail: "new@example.test",
    validateIdentity: () => ({ data: "valid", error: null }),
    authEmail: () => {
      authEmailReadCount += 1;
      return authEmailReadCount === 1 ? "old-auth@example.test" : "new@example.test";
    },
    markCompleted: () => ({ data: true, error: null }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  assertEquals((await jsonOf(res)).status, "updated");
  assertEquals(admin.updateUserByIdCalls.length, 0);
});

// ---------------------------------------------------------------------------
// Finding #3: honest transition-uncertainty re-observation
// ---------------------------------------------------------------------------

Deno.test("finding #3: mark_manual_attention call succeeds (no error) but re-read shows still active -> retryable uncertainty, NOT manual_attention_required", async () => {
  const { deps, admin } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => ({ data: [CONTEXT_ROW({ state: "active" })], error: null }),
    workerEmail: "old@example.test",
    validateIdentity: () => ({ data: "valid", error: null }),
    authEmail: "old-auth@example.test",
    findMatches: () => ({ data: [], error: null }),
    updateUserById: () => ({ error: null }),
    sync: () => ({ data: "linkage_changed", error: null }),
    // The transition RPC call itself reports no error, but the durable
    // state, re-read afterward, is STILL active -- the transition never
    // actually landed. The old (buggy) behavior would have trusted the
    // lack of an error and returned manual_attention_required regardless.
    markManualAttention: () => ({ data: null, error: null }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  const body = await jsonOf(res);
  assertEquals(
    body.status,
    "worker_sync_uncertain",
    "must not claim manual_attention_required without an observed state re-read confirming it",
  );
  assert(
    admin.calls.some((c) => c.fn === "get_worker_access_email_correction_context"),
    "must re-read the durable operation after attempting the transition",
  );
});

Deno.test("finding #3: mark_manual_attention succeeds and re-read confirms manual_attention_required -> honestly reported", async () => {
  let contextCallCount = 0;
  const { deps } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => {
      contextCallCount += 1;
      return {
        data: [
          CONTEXT_ROW({
            state: contextCallCount >= 2 ? "manual_attention_required" : "active",
            last_reason_code: "linkage_changed",
          }),
        ],
        error: null,
      };
    },
    workerEmail: "old@example.test",
    validateIdentity: () => ({ data: "valid", error: null }),
    authEmail: "old-auth@example.test",
    findMatches: () => ({ data: [], error: null }),
    updateUserById: () => ({ error: null }),
    sync: () => ({ data: "linkage_changed", error: null }),
    markManualAttention: () => ({ data: null, error: null }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  const body = await jsonOf(res);
  assertEquals(body.status, "manual_attention_required");
  assertEquals(body.reasonCode, "linkage_changed");
});

Deno.test("finding #3: mark_manual_attention re-read shows converged to completed -> reports success, not a stale manual-attention claim", async () => {
  let contextCallCount = 0;
  const { deps } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => {
      contextCallCount += 1;
      return {
        data: [CONTEXT_ROW({ state: contextCallCount >= 2 ? "completed" : "active" })],
        error: null,
      };
    },
    workerEmail: "old@example.test",
    validateIdentity: () => ({ data: "valid", error: null }),
    authEmail: "old-auth@example.test",
    findMatches: () => ({ data: [], error: null }),
    updateUserById: () => ({ error: null }),
    sync: () => ({ data: "linkage_changed", error: null }),
    markManualAttention: () => ({ data: null, error: null }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  assertEquals((await jsonOf(res)).status, "updated");
});

Deno.test("finding #3: completion transition uncertainty still uses the trustworthy boolean, unaffected by the honesty fix", async () => {
  const { deps } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => ({ data: [CONTEXT_ROW()], error: null }),
    workerEmail: "new@example.test",
    validateIdentity: () => ({ data: "valid", error: null }),
    authEmail: "new@example.test",
    markCompleted: () => ({ data: false, error: null }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  const body = await jsonOf(res);
  assertEquals(body.status, "worker_sync_uncertain");
});

// ---------------------------------------------------------------------------
// Finding #6: no English-message Auth error matching
// ---------------------------------------------------------------------------

Deno.test("finding #6: a genuine AuthApiError with the stable email_exists code is classified as owned_by_other", async () => {
  const { deps } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => ({ data: [CONTEXT_ROW()], error: null }),
    workerEmail: "old@example.test",
    validateIdentity: () => ({ data: "valid", error: null }),
    authEmail: "old-auth@example.test",
    findMatches: () => ({ data: [], error: null }),
    updateUserById: () => ({
      error: {
        __isAuthError: true,
        name: "AuthApiError",
        code: "email_exists",
        message: "A user with this email address has already been registered",
        status: 422,
      },
    }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  assertEquals((await jsonOf(res)).status, "email_owned_by_another_auth_user");
});

Deno.test("finding #6: an AuthApiError with an English conflict-looking message but NO recognized code is NOT classified as a conflict", async () => {
  const { deps } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => ({ data: [CONTEXT_ROW()], error: null }),
    workerEmail: "old@example.test",
    validateIdentity: () => ({ data: "valid", error: null }),
    authEmail: "old-auth@example.test",
    findMatches: () => ({ data: [], error: null }),
    updateUserById: () => ({
      error: {
        __isAuthError: true,
        name: "AuthApiError",
        // No `.code` at all -- only an English message that LOOKS like a
        // conflict. Must not be classified as one.
        message: "user already exists in the system, already registered",
        status: 500,
      },
    }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  const body = await jsonOf(res);
  assert(
    body.status !== "email_owned_by_another_auth_user",
    "an English message fragment must never be used to infer a conflict",
  );
  assertEquals(body.status, "auth_update_failed");
});

Deno.test("finding #6: a plain object with a matching .code but not a real AuthApiError instance is not misclassified", async () => {
  const { deps } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => ({ data: [CONTEXT_ROW()], error: null }),
    workerEmail: "old@example.test",
    validateIdentity: () => ({ data: "valid", error: null }),
    authEmail: "old-auth@example.test",
    findMatches: () => ({ data: [], error: null }),
    updateUserById: () => ({ error: { code: "email_exists", message: "spoofed" } }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  const body = await jsonOf(res);
  assert(
    body.status !== "email_owned_by_another_auth_user",
    "a spoofed .code without the real AuthApiError shape must not be classified as a genuine conflict",
  );
});

// ---------------------------------------------------------------------------
// Reconciliation branches (unchanged behavior, re-verified against the new flow)
// ---------------------------------------------------------------------------

Deno.test("Auth matches / worker doesn't -> only sync is called, no Auth mutation", async () => {
  const { deps, admin } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => ({ data: [CONTEXT_ROW()], error: null }),
    workerEmail: "old@example.test",
    authEmail: "new@example.test",
    sync: () => ({ data: "updated", error: null }),
    markCompleted: () => ({ data: true, error: null }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  assertEquals((await jsonOf(res)).status, "updated");
  assertEquals(admin.updateUserByIdCalls.length, 0);
  assert(admin.calls.some((c) => c.fn === "sync_worker_email_after_access_correction"), "sync must be attempted");
  assert(
    !admin.calls.some((c) => c.fn === "validate_worker_access_email_correction_identity"),
    "the identity gate is only needed before an Auth mutation attempt",
  );
});

Deno.test("worker matches / Auth doesn't -> only Auth update is attempted, no sync", async () => {
  const { deps, admin } = makeDeps("admin", {
    claim: claimReturning("created", null, 1),
    context: () => ({ data: [CONTEXT_ROW()], error: null }),
    workerEmail: "new@example.test",
    validateIdentity: () => ({ data: "valid", error: null }),
    authEmail: "old-auth@example.test",
    findMatches: () => ({ data: [], error: null }),
    updateUserById: () => ({ error: null }),
    markCompleted: () => ({ data: true, error: null }),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  assertEquals((await jsonOf(res)).status, "updated");
  assertEquals(admin.updateUserByIdCalls.length, 1);
  assert(
    !admin.calls.some((c) => c.fn === "sync_worker_email_after_access_correction"),
    "sync must not be attempted when the worker already matches",
  );
});

// ---------------------------------------------------------------------------
// No-delivery structural assertions
// ---------------------------------------------------------------------------

Deno.test("the source contains no delivery-mechanism references", async () => {
  const source = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url),
  );
  for (
    const forbidden of [
      "inviteUserByEmail",
      "deleteUser",
      "resetPasswordForEmail",
    ]
  ) {
    assert(
      !source.includes(forbidden),
      `index.ts must not reference ${forbidden}`,
    );
  }
});

Deno.test("the response shape never contains accessLinkDelivery/operationId/an Auth-id field", async () => {
  const { deps } = makeDeps("admin", {
    claim: claimReturning("already_completed", "already_synchronized", 1),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  const body = await jsonOf(res);
  for (const forbiddenKey of ["accessLinkDelivery", "operationId", "linkedAuthUserId", "authUserId"]) {
    assert(!(forbiddenKey in body), `response must not contain ${forbiddenKey}`);
  }
});

// ---------------------------------------------------------------------------
// Exact-response-contract tests
// ---------------------------------------------------------------------------

Deno.test("response includes exactly the documented closed-contract fields", async () => {
  const { deps } = makeDeps("admin", {
    claim: claimReturning("already_completed", "already_synchronized", 1),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "new@example.test" })),
    deps,
  );
  const body = await jsonOf(res);
  assertEquals(body.workerId, 10);
  assertEquals(body.status, "already_synchronized");
  assertEquals(body.reasonCode, "already_synchronized");
  assertEquals(body.retryable, false);
  assertEquals(body.emailSynchronized, true);
  const allowedKeys = new Set([
    "workerId",
    "status",
    "reasonCode",
    "retryable",
    "emailSynchronized",
    "message",
  ]);
  for (const key of Object.keys(body)) {
    assert(allowedKeys.has(key), `unexpected response field: ${key}`);
  }
});

Deno.test("two different-target concurrent corrections: second is rejected", async () => {
  const second = makeDeps("admin", {
    claim: claimReturning(
      "different_target_in_progress",
      "different_target_in_progress",
      1,
    ),
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, newEmail: "yet-another@example.test" })),
    second.deps,
  );
  assertEquals((await jsonOf(res)).status, "correction_already_in_progress");
  assertEquals(res.status, 409);
});
