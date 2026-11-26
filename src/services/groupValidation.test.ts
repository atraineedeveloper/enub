import { describe, expect, test } from "bun:test";
import { validateGroupIdentity, validateGroupReason, validateGroupVersion } from "./groupValidation";
import { groupMutationError } from "./groupErrors";

describe("group lifecycle validation", () => {
  test("normalizes identity and excludes server metadata", () => {
    expect(validateGroupIdentity({ year_of_admission: "2027", letter: " d ", degree_id: "2", version: 99, id: 100 })).toEqual({ year_of_admission: 2027, letter: "D", degree_id: 2 });
  });
  test("rejects invalid identity fields", () => {
    for (const value of ["", "1e3", "1.5", -1, true, null, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => validateGroupIdentity({ year_of_admission: value, letter: "A", degree_id: 2 })).toThrow();
    }
    expect(() => validateGroupIdentity({ year_of_admission: 2026, letter: " ", degree_id: 2 })).toThrow();
    expect(() => validateGroupIdentity({ year_of_admission: 2026, letter: "A", degree_id: "" })).toThrow();
  });
  test("requires valid version and reason", () => {
    expect(validateGroupVersion({ id: 2, version: 1 })).toEqual({ id: 2, version: 1 });
    expect(() => validateGroupVersion({ id: 2, version: 0 })).toThrow();
    expect(validateGroupReason("  Corrección  ")).toBe("Corrección");
    expect(() => validateGroupReason(" ")).toThrow();
    expect(() => validateGroupReason("a".repeat(501))).toThrow();
  });
  test("maps conflict, authorization and unknown outcome safely", () => {
    expect(groupMutationError({ code: "GRP01" }).message).toContain("Actualiza");
    expect(groupMutationError({ code: "GRP02" }).message).toContain("horarios");
    expect(groupMutationError({ code: "42501" }).message).toContain("permisos");
    expect(groupMutationError({ code: "PGRST000" }).message).toContain("confirmar");
    expect(groupMutationError({ code: "toString" }).message).toContain("No se pudo");
  });
});
