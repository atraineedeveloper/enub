import { describe, expect, test } from "bun:test";
import { resolveRouteContextLabel } from "./routeContext";

describe("resolveRouteContextLabel (most-specific-match route resolver)", () => {
  test("/dashboard -> Inicio", () => {
    expect(resolveRouteContextLabel("/dashboard")).toBe("Inicio");
  });

  test("/workers -> Trabajadores", () => {
    expect(resolveRouteContextLabel("/workers")).toBe("Trabajadores");
  });

  test("/workers/:id -> Detalle del trabajador", () => {
    expect(resolveRouteContextLabel("/workers/42")).toBe("Detalle del trabajador");
  });

  test("/workers/:id/documents -> Documentos del trabajador, winning over /workers/:id and /workers", () => {
    expect(resolveRouteContextLabel("/workers/42/documents")).toBe(
      "Documentos del trabajador"
    );
  });

  test("/semesters -> Semestres", () => {
    expect(resolveRouteContextLabel("/semesters")).toBe("Semestres");
  });

  test("/semesters/:id -> exactly Horario del semestre, distinct from Semestres", () => {
    expect(resolveRouteContextLabel("/semesters/7")).toBe("Horario del semestre");
    expect(resolveRouteContextLabel("/semesters/7")).not.toBe("Semestres");
  });

  test("the specific /semesters/:id pattern wins over the general /semesters pattern", () => {
    const specific = resolveRouteContextLabel("/semesters/7");
    const general = resolveRouteContextLabel("/semesters");
    expect(specific).toBe("Horario del semestre");
    expect(general).toBe("Semestres");
    expect(specific).not.toBe(general);
  });

  test("/my-documents -> Mis documentos", () => {
    expect(resolveRouteContextLabel("/my-documents")).toBe("Mis documentos");
  });

  test("an unknown authenticated route falls back to ENUB, never a raw segment", () => {
    expect(resolveRouteContextLabel("/some-unmapped-route")).toBe("ENUB");
  });

  test("the fallback never leaks the raw pathname", () => {
    const result = resolveRouteContextLabel("/totally/unknown/nested/path");
    expect(result).toBe("ENUB");
    expect(result).not.toContain("unknown");
  });
});
