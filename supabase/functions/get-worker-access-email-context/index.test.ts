// Deno tests for get-worker-access-email-context. Dependency-injected
// fakes only -- no real network or database calls.

import { handleRequest, type HandlerDeps } from "./index.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

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

function makeUserClient(role: string | null): SupabaseClient {
  return {
    rpc: (fn: string) => {
      if (fn === "current_app_role") {
        return Promise.resolve({ data: role, error: null });
      }
      throw new Error(`Unexpected userClient.rpc call: ${fn}`);
    },
  } as unknown as SupabaseClient;
}

interface AdminClientConfig {
  worker?: { id: number; name: string } | null;
  workerError?: unknown;
  profile?: { id: string; role: string } | null;
  profileError?: unknown;
  authEmail?: string | null;
  authEmailError?: unknown;
}

interface AdminClientFake {
  client: SupabaseClient;
  calls: { fn: string; params?: unknown }[];
}

function makeAdminClient(config: AdminClientConfig): AdminClientFake {
  const calls: { fn: string; params?: unknown }[] = [];

  const client = {
    from: (table: string) => {
      if (table === "workers") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: config.worker === undefined ? null : config.worker,
                  error: config.workerError ?? null,
                }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: config.profile === undefined ? null : config.profile,
                  error: config.profileError ?? null,
                }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: (fn: string, params?: unknown) => {
      calls.push({ fn, params });
      if (fn === "get_linked_worker_auth_email_context") {
        return Promise.resolve({
          data: config.authEmail === undefined ? null : config.authEmail,
          error: config.authEmailError ?? null,
        });
      }
      throw new Error(`Unexpected adminClient.rpc call: ${fn}`);
    },
  } as unknown as SupabaseClient;

  return { client, calls };
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
  return new Request("https://example.test/get-worker-access-email-context", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

async function jsonOf(res: Response): Promise<Record<string, unknown>> {
  return await res.json();
}

const FULL_CONFIG: AdminClientConfig = {
  worker: { id: 10, name: "Ada Lovelace" },
  profile: { id: "auth-1", role: "worker" },
  authEmail: "ada@example.test",
};

// ---------------------------------------------------------------------------
// Authorization-before-parsing, all four combinations
// ---------------------------------------------------------------------------

Deno.test("unauthenticated + malformed body -> unauthorized/401, workerId null, body never parsed", async () => {
  const { deps, admin } = makeDeps("admin", FULL_CONFIG);
  const res = await handleRequest(
    makeRequest("{not valid json", { authorization: null }),
    deps,
  );
  assertEquals(res.status, 401);
  const body = await jsonOf(res);
  assertEquals(body.status, "unauthorized");
  assertEquals(body.workerId, null);
  assertEquals(admin.calls.length, 0);
});

Deno.test("unauthenticated + unknown-key body -> unauthorized/401, body never parsed", async () => {
  const { deps, admin } = makeDeps("admin", FULL_CONFIG);
  const res = await handleRequest(
    makeRequest(JSON.stringify({ foo: "bar" }), { authorization: null }),
    deps,
  );
  assertEquals(res.status, 401);
  assertEquals(admin.calls.length, 0);
});

Deno.test("non-admin + malformed body -> forbidden/403, body never parsed", async () => {
  const { deps, admin } = makeDeps("worker", FULL_CONFIG);
  const res = await handleRequest(makeRequest("{not valid json"), deps);
  assertEquals(res.status, 403);
  assertEquals((await jsonOf(res)).status, "forbidden");
  assertEquals(admin.calls.length, 0);
});

Deno.test("non-admin + unknown-key body -> forbidden/403, body never parsed", async () => {
  const { deps, admin } = makeDeps("staff", FULL_CONFIG);
  const res = await handleRequest(
    makeRequest(JSON.stringify({ foo: "bar" })),
    deps,
  );
  assertEquals(res.status, 403);
  assertEquals(admin.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Closed contract for every infrastructure/request-validation branch
// (code-review finding #5)
// ---------------------------------------------------------------------------

Deno.test("GET -> method_not_allowed/405, closed contract, workerId null", async () => {
  const { deps } = makeDeps("admin", FULL_CONFIG);
  const req = new Request("https://example.test/get-worker-access-email-context", {
    method: "GET",
  });
  const res = await handleRequest(req, deps);
  assertEquals(res.status, 405);
  const body = await jsonOf(res);
  assertEquals(body.status, "method_not_allowed");
  assertEquals(body.workerId, null);
  assert(!("error" in body), "must not use the ad hoc { error } shape");
});

Deno.test("missing SUPABASE_URL -> server_misconfigured/500, closed contract", async () => {
  const admin = makeAdminClient(FULL_CONFIG);
  const deps: HandlerDeps = {
    getEnv: (name) => (name === "SUPABASE_URL" ? undefined : "some-value"),
    createUserClient: () => makeUserClient("admin"),
    createAdminClient: () => admin.client,
  };
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10 })),
    deps,
  );
  assertEquals(res.status, 500);
  const body = await jsonOf(res);
  assertEquals(body.status, "server_misconfigured");
  assert(!("error" in body), "must not use the ad hoc { error } shape");
});

Deno.test("role-RPC failure -> internal_error/500, no raw message leaked", async () => {
  const admin = makeAdminClient(FULL_CONFIG);
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
    makeRequest(JSON.stringify({ workerId: 10 })),
    deps,
  );
  assertEquals(res.status, 500);
  const body = await jsonOf(res);
  assertEquals(body.status, "internal_error");
  assert(
    !JSON.stringify(body).includes("raw internal postgres error detail"),
    "must not leak the raw internal error message",
  );
});

Deno.test("worker lookup DB failure -> internal_error/500", async () => {
  const { deps } = makeDeps("admin", {
    ...FULL_CONFIG,
    workerError: { message: "connection reset" },
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10 })),
    deps,
  );
  assertEquals(res.status, 500);
  assertEquals((await jsonOf(res)).status, "internal_error");
});

Deno.test("profile lookup DB failure -> internal_error/500", async () => {
  const { deps } = makeDeps("admin", {
    ...FULL_CONFIG,
    profileError: { message: "connection reset" },
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10 })),
    deps,
  );
  assertEquals(res.status, 500);
  assertEquals((await jsonOf(res)).status, "internal_error");
});

Deno.test("catch-all: an uncaught exception -> internal_error/500", async () => {
  const admin = makeAdminClient(FULL_CONFIG);
  (admin.client as unknown as { from: (t: string) => unknown }).from = () => {
    throw new Error("boom");
  };
  const deps: HandlerDeps = {
    getEnv: (name) =>
      ({
        SUPABASE_URL: "https://example.test",
        SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      })[name],
    createUserClient: () => makeUserClient("admin"),
    createAdminClient: () => admin.client,
  };
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10 })),
    deps,
  );
  assertEquals(res.status, 500);
  assertEquals((await jsonOf(res)).status, "internal_error");
});

// ---------------------------------------------------------------------------
// Response-minimization tests
// ---------------------------------------------------------------------------

Deno.test("masked (default) response contains only a masked email and worker display data", async () => {
  const { deps } = makeDeps("admin", FULL_CONFIG);
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10 })),
    deps,
  );
  assertEquals(res.status, 200);
  const body = await jsonOf(res);
  assertEquals(body.status, "ok");
  assertEquals(body.revealed, false);
  assert(
    typeof body.email === "string" && body.email !== "ada@example.test",
    "masked response must not contain the full email",
  );
  for (const forbiddenKey of ["authUserId", "linkedAuthUserId", "operationId", "id"]) {
    assert(!(forbiddenKey in body), `masked response must not contain ${forbiddenKey}`);
  }
});

Deno.test("revealed response contains the full email, still no Auth id/operation id", async () => {
  const { deps } = makeDeps("admin", FULL_CONFIG);
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, reveal: true })),
    deps,
  );
  assertEquals(res.status, 200);
  const body = await jsonOf(res);
  assertEquals(body.status, "ok");
  assertEquals(body.revealed, true);
  assertEquals(body.email, "ada@example.test");
  for (const forbiddenKey of ["authUserId", "linkedAuthUserId", "operationId", "id"]) {
    assert(!(forbiddenKey in body), `revealed response must not contain ${forbiddenKey}`);
  }
});

Deno.test("worker/staff callers are rejected before any read", async () => {
  for (const role of ["worker", "staff"]) {
    const { deps, admin } = makeDeps(role, FULL_CONFIG);
    const res = await handleRequest(
      makeRequest(JSON.stringify({ workerId: 10 })),
      deps,
    );
    assertEquals(res.status, 403);
    assertEquals(admin.calls.length, 0, `${role} must not trigger any worker/profile/Auth read`);
  }
});

// ---------------------------------------------------------------------------
// Closed-contract tests: every documented status/HTTP pair
// ---------------------------------------------------------------------------

Deno.test("invalid_request/400 for a malformed authorized body", async () => {
  const { deps } = makeDeps("admin", FULL_CONFIG);
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10, unknownField: true })),
    deps,
  );
  assertEquals(res.status, 400);
  assertEquals((await jsonOf(res)).status, "invalid_request");
});

Deno.test("worker_not_found/404", async () => {
  const { deps } = makeDeps("admin", { ...FULL_CONFIG, worker: null });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 999 })),
    deps,
  );
  assertEquals(res.status, 404);
  assertEquals((await jsonOf(res)).status, "worker_not_found");
});

Deno.test("worker_not_linked/409", async () => {
  const { deps } = makeDeps("admin", { ...FULL_CONFIG, profile: null });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10 })),
    deps,
  );
  assertEquals(res.status, 409);
  assertEquals((await jsonOf(res)).status, "worker_not_linked");
});

Deno.test("invalid_profile_role/500", async () => {
  const { deps } = makeDeps("admin", {
    ...FULL_CONFIG,
    profile: { id: "auth-1", role: "admin" },
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10 })),
    deps,
  );
  assertEquals(res.status, 500);
  const body = await jsonOf(res);
  assertEquals(body.status, "invalid_profile_role");
  assertEquals(body.message, "Revisión manual requerida");
});

Deno.test("linked_auth_user_missing/500", async () => {
  const { deps } = makeDeps("admin", { ...FULL_CONFIG, authEmail: null });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10 })),
    deps,
  );
  assertEquals(res.status, 500);
  const body = await jsonOf(res);
  assertEquals(body.status, "linked_auth_user_missing");
  assertEquals(body.message, "Revisión manual requerida");
});

Deno.test("linked_auth_user_missing/500 when the resolution RPC itself errors", async () => {
  const { deps } = makeDeps("admin", {
    ...FULL_CONFIG,
    authEmailError: { code: "WAEC6", message: "no valid linked worker profile" },
  });
  const res = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10 })),
    deps,
  );
  assertEquals(res.status, 500);
  assertEquals((await jsonOf(res)).status, "linked_auth_user_missing");
});

Deno.test("unauthorized/401 and forbidden/403 exercised with well-formed bodies too", async () => {
  const unauth = makeDeps("admin", FULL_CONFIG);
  const unauthRes = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10 }), { authorization: null }),
    unauth.deps,
  );
  assertEquals(unauthRes.status, 401);
  assertEquals((await jsonOf(unauthRes)).status, "unauthorized");

  const forbidden = makeDeps("worker", FULL_CONFIG);
  const forbiddenRes = await handleRequest(
    makeRequest(JSON.stringify({ workerId: 10 })),
    forbidden.deps,
  );
  assertEquals(forbiddenRes.status, 403);
  assertEquals((await jsonOf(forbiddenRes)).status, "forbidden");
});
