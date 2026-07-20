import { describe, expect, mock, test } from "bun:test";
import {
  createWorkerUpdateError,
  getSupabaseErrorDiagnostic,
  WORKER_UPDATE_ERROR_MESSAGE,
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

  test("logs the original diagnostic but exposes only the safe user message", () => {
    const logger = mock(() => undefined);
    const error = createWorkerUpdateError(originalError, logger);

    expect(logger).toHaveBeenCalledWith(
      "Supabase worker update failed",
      originalError
    );
    expect(error.message).toBe(WORKER_UPDATE_ERROR_MESSAGE);
    expect(error.message).not.toContain(originalError.details);
    expect(error.message).not.toContain(originalError.hint);
    expect(error.cause).toBe(originalError);
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
