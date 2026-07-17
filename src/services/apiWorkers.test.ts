import { describe, expect, test, mock } from "bun:test";

let nextResponse: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let lastSelectArg: string | null = null;
let lastEqArgs: [string, unknown] | null = null;

// getWorkerIdentityById/getMyWorkerProfile are the only exports under test
// here, and the only apiWorkers.ts functions this suite needs a real
// Supabase client for -- the module import is stubbed so the test never
// depends on env vars or a live connection, and so a "no row" result can
// be distinguished from a thrown error without hitting a real database.
// The select()/eq() arguments are captured so the exact projection itself
// (not just its runtime behavior) is directly assertable.
mock.module("./supabase", () => ({
  default: {
    from: () => ({
      select: (arg: string) => {
        lastSelectArg = arg;
        return {
          eq: (column: string, value: unknown) => {
            lastEqArgs = [column, value];
            return {
              maybeSingle: async () => nextResponse,
            };
          },
        };
      },
    }),
  },
}));

const { getWorkerIdentityById, getMyWorkerProfile } = await import("./apiWorkers");

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

describe("getMyWorkerProfile (exact eight-field projection)", () => {
  test("selects exactly the eight allow-listed fields, in the documented order", async () => {
    nextResponse = { data: null, error: null };
    await getMyWorkerProfile(7);

    expect(lastSelectArg).toBe(
      "name, email, phone, type_worker, status, specialty, function_performed, profile_picture"
    );
  });

  test("never requests id, RFC, address fields, observations, or created_at", async () => {
    nextResponse = { data: null, error: null };
    await getMyWorkerProfile(7);

    const excluded = ["RFC", "city", "neighborhood", "post_code", "state", "street", "observations", "created_at", "*"];
    for (const field of excluded) {
      expect(lastSelectArg).not.toContain(field);
    }
  });

  test("never uses select(\"*\")", async () => {
    nextResponse = { data: null, error: null };
    await getMyWorkerProfile(7);
    expect(lastSelectArg).not.toBe("*");
  });

  test("filters by the exact id column and the given value", async () => {
    nextResponse = { data: null, error: null };
    await getMyWorkerProfile(42);
    expect(lastEqArgs).toEqual(["id", 42]);
  });

  test("a matching row returns exactly its eight fields", async () => {
    const row = {
      name: "Ana Pérez",
      email: "ana@example.test",
      phone: "555-0000",
      type_worker: "Docente",
      status: 1,
      specialty: "Matemáticas",
      function_performed: "Titular",
      profile_picture: null,
    };
    nextResponse = { data: row, error: null };

    const result = await getMyWorkerProfile(7);
    expect(result).toEqual(row);
  });

  test("no matching row resolves to null without throwing", async () => {
    nextResponse = { data: null, error: null };
    const result = await getMyWorkerProfile(999);
    expect(result).toBeNull();
  });

  test("a transport/RLS/database error throws the exact Spanish message", async () => {
    nextResponse = { data: null, error: { message: "connection refused" } };
    await expect(getMyWorkerProfile(7)).rejects.toThrow("La información no pudo cargarse");
  });
});
