import { describe, expect, test, mock } from "bun:test";

let nextResponse: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};

// getWorkerIdentityById is the only export under test here, and it is the
// only apiWorkers.ts function this suite needs a real Supabase client for --
// the module import is stubbed so the test never depends on env vars or a
// live connection, and so a "no row" result can be distinguished from a
// thrown error without hitting a real database.
mock.module("./supabase", () => ({
  default: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => nextResponse,
        }),
      }),
    }),
  },
}));

const { getWorkerIdentityById } = await import("./apiWorkers");

describe("getWorkerIdentityById (missing row vs. query failure)", () => {
  test("a matching row returns its name and profile_picture", async () => {
    nextResponse = {
      data: { name: "Ana Pérez", profile_picture: "ana.jpg" },
      error: null,
    };

    const result = await getWorkerIdentityById(7);
    expect(result).toEqual({ name: "Ana Pérez", profile_picture: "ana.jpg" });
  });

  test("no matching row resolves to null without throwing", async () => {
    nextResponse = { data: null, error: null };

    const result = await getWorkerIdentityById(999);
    expect(result).toBeNull();
  });

  test("a transport/RLS/database error throws, distinct from a missing row", async () => {
    nextResponse = {
      data: null,
      error: { message: "connection refused" },
    };

    await expect(getWorkerIdentityById(7)).rejects.toThrow(
      "El perfil del trabajador no pudo cargarse"
    );
  });
});
