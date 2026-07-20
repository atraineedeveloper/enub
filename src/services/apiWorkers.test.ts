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

describe("getMyWorkerProfile (explicit projection, nested relations, no select(*))", () => {
  test("selects exactly the documented flat columns plus the two narrow embedded relations", async () => {
    nextResponse = { data: null, error: null };
    await getMyWorkerProfile(7);

    expect(lastSelectArg).toBe(
      "name, RFC, email, phone, street, neighborhood, post_code, city, state, " +
        "type_worker, specialty, function_performed, status, profile_picture, " +
        "sustenance_plazas(sustenance, payment_key, plaza), " +
        "date_of_admissions(type, date_of_admission)"
    );
  });

  test("never requests id, worker_id, observations, created_at, or a raw select(*) anywhere in the string", async () => {
    nextResponse = { data: null, error: null };
    await getMyWorkerProfile(7);

    const excluded = ["observations", "created_at", "worker_id", "*"];
    for (const field of excluded) {
      expect(lastSelectArg).not.toContain(field);
    }
    // "id" alone would also match inside "worker_id"/other substrings, so
    // check it as a field boundary instead of a plain substring.
    expect(lastSelectArg).not.toMatch(/(^|[,\s(])id(,|\s|$)/);
  });

  test("never uses select(\"*\")", async () => {
    nextResponse = { data: null, error: null };
    await getMyWorkerProfile(7);
    expect(lastSelectArg).not.toBe("*");
  });

  test("each embedded relation requests only its own narrow, explicit columns", async () => {
    nextResponse = { data: null, error: null };
    await getMyWorkerProfile(7);

    expect(lastSelectArg).toContain(
      "sustenance_plazas(sustenance, payment_key, plaza)"
    );
    expect(lastSelectArg).toContain(
      "date_of_admissions(type, date_of_admission)"
    );
    expect(lastSelectArg).not.toContain("sustenance_plazas(*)");
    expect(lastSelectArg).not.toContain("date_of_admissions(*)");
  });

  test("filters by the exact id column and the given value -- a row-selection filter, not an authorization mechanism", async () => {
    nextResponse = { data: null, error: null };
    await getMyWorkerProfile(42);
    expect(lastEqArgs).toEqual(["id", 42]);
  });

  test("a matching row returns exactly the requested fields, including nested relation arrays", async () => {
    const row = {
      name: "Ana Pérez",
      RFC: "PEAA800101ABC",
      email: "ana@example.test",
      phone: "555-0000",
      street: "Av. Reforma 123",
      neighborhood: "Centro",
      post_code: "86000",
      city: "Villahermosa",
      state: "Tabasco",
      type_worker: "Docente",
      specialty: "Matemáticas",
      function_performed: "Titular",
      status: 1,
      profile_picture: null,
      sustenance_plazas: [{ sustenance: "Estatal", payment_key: "01", plaza: "Base" }],
      date_of_admissions: [{ type: "Ingreso", date_of_admission: "2020-01-01" }],
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
