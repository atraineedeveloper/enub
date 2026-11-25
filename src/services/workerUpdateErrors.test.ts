import { describe, expect, mock, test } from "bun:test";
import {
  createWorkerUpdateError,
  getSupabaseErrorDiagnostic,
} from "./workerUpdateErrors";

describe("worker update error reporting", () => {
  const originalError = {
    code: "42501",
    message: "new row violates row-level security policy",
    details: "Sensitive database detail",
    hint: "Sensitive database hint",
  };

  test("retains code, message, details and hint for developer diagnostics", () => {
    expect(getSupabaseErrorDiagnostic(originalError)).toEqual(originalError);
  });

  test("logs only the error code and exposes a safe permission message", () => {
    const logger = mock(() => undefined);
    const error = createWorkerUpdateError(originalError, logger);

    expect(logger).toHaveBeenCalledWith(
      "Supabase worker update failed",
      { code: "42501" }
    );
    expect(error.message).toBe("No tienes permisos para actualizar este trabajador.");
    expect(error.message).not.toContain(originalError.details);
    expect(error.message).not.toContain(originalError.hint);
    expect(error.cause).toBe(originalError);
  });

  test("reports ambiguous transport outcome without claiming rollback", () => {
    expect(createWorkerUpdateError({ code: "" }, mock(() => undefined)).message).toContain("No se pudo confirmar");
  });

  test("normalizes absent optional diagnostic fields to null", () => {
    expect(
      getSupabaseErrorDiagnostic({ message: "network request failed" })
    ).toEqual({
      code: null,
      message: "network request failed",
      details: null,
      hint: null,
    });
  });
});
