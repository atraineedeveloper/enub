import { describe, expect, test } from "bun:test";
import {
  formatOptionalWorkerField,
  formatWorkerType,
  translateWorkerStatus,
} from "./workerProfileLabels";

describe("translateWorkerStatus (exact status mapping)", () => {
  test("1 -> Activo", () => {
    expect(translateWorkerStatus(1)).toBe("Activo");
  });

  test("0 -> Inactivo", () => {
    expect(translateWorkerStatus(0)).toBe("Inactivo");
  });

  test("any other number -> Estado desconocido", () => {
    expect(translateWorkerStatus(2)).toBe("Estado desconocido");
    expect(translateWorkerStatus(-1)).toBe("Estado desconocido");
  });

  test("null -> Estado desconocido", () => {
    expect(translateWorkerStatus(null)).toBe("Estado desconocido");
  });

  test("undefined -> Estado desconocido", () => {
    expect(translateWorkerStatus(undefined)).toBe("Estado desconocido");
  });

  test("a malformed/non-numeric value -> Estado desconocido, never a throw", () => {
    expect(translateWorkerStatus(NaN)).toBe("Estado desconocido");
    expect(translateWorkerStatus("1" as unknown as number)).toBe("Estado desconocido");
  });
});

describe("formatOptionalWorkerField (email/phone/specialty/function_performed)", () => {
  test("a real value passes through unchanged", () => {
    expect(formatOptionalWorkerField("ana@example.com")).toBe("ana@example.com");
  });

  test("null -> No registrado", () => {
    expect(formatOptionalWorkerField(null)).toBe("No registrado");
  });

  test("undefined -> No registrado", () => {
    expect(formatOptionalWorkerField(undefined)).toBe("No registrado");
  });

  test("an empty string -> No registrado", () => {
    expect(formatOptionalWorkerField("")).toBe("No registrado");
  });

  test("a whitespace-only string -> No registrado", () => {
    expect(formatOptionalWorkerField("   ")).toBe("No registrado");
  });
});

describe("formatWorkerType (distinct wording from the generic fallback)", () => {
  test("a real value passes through unchanged", () => {
    expect(formatWorkerType("Docente")).toBe("Docente");
  });

  test("null -> exactly 'Tipo no especificado', not 'No registrado'", () => {
    expect(formatWorkerType(null)).toBe("Tipo no especificado");
  });

  test("an empty string -> 'Tipo no especificado'", () => {
    expect(formatWorkerType("")).toBe("Tipo no especificado");
  });
});
