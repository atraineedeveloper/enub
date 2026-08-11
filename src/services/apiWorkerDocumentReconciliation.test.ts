import { describe, expect, mock, test } from "bun:test";

let nextResponse: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let lastInvocation: { name: string; options: unknown } | null = null;

mock.module("./supabase", () => ({
  default: {
    functions: {
      invoke: async (name: string, options: unknown) => {
        lastInvocation = { name, options };
        return nextResponse;
      },
    },
  },
}));

const {
  reconcileWorkerDocumentStorage,
  reconciliationClearedPendingCleanup,
} = await import("./apiWorkerDocumentReconciliation");

describe("reconcileWorkerDocumentStorage", () => {
  test("invokes only the queue-driven worker reconciliation endpoint", async () => {
    nextResponse = {
      data: {
        matched: 2,
        resolved: 2,
        failed: 0,
        conflicts: 0,
        remainingMayExist: false,
      },
      error: null,
    };

    const result = await reconcileWorkerDocumentStorage(7);

    expect(lastInvocation).toEqual({
      name: "reconcile-worker-document-storage",
      options: { body: { workerId: 7 } },
    });
    expect(result).toEqual({
      matched: 2,
      resolved: 2,
      failed: 0,
      conflicts: 0,
      remainingMayExist: false,
    });
  });

  test("rejects an invalid worker id before invoking the function", async () => {
    lastInvocation = null;
    await expect(reconcileWorkerDocumentStorage(0)).rejects.toThrow(
      "El trabajador es requerido"
    );
    expect(lastInvocation).toBeNull();
  });

  test("maps a function invocation failure to a controlled client error", async () => {
    nextResponse = { data: null, error: { message: "function unavailable" } };

    await expect(reconcileWorkerDocumentStorage(7)).rejects.toThrow(
      "La limpieza pendiente de documentos no pudo reconciliarse"
    );
  });
});

describe("reconciliationClearedPendingCleanup", () => {
  test("clears a prior warning only when the finite pending batch is fully clean", () => {
    expect(
      reconciliationClearedPendingCleanup({
        matched: 1,
        resolved: 1,
        failed: 0,
        conflicts: 0,
        remainingMayExist: false,
      })
    ).toBe(true);
  });

  test("stays conservative for empty, failed, conflicting, or possibly-truncated batches", () => {
    const cases = [
      { matched: 0, resolved: 0, failed: 0, conflicts: 0, remainingMayExist: false },
      { matched: 1, resolved: 0, failed: 1, conflicts: 0, remainingMayExist: false },
      { matched: 1, resolved: 0, failed: 0, conflicts: 1, remainingMayExist: false },
      { matched: 20, resolved: 20, failed: 0, conflicts: 0, remainingMayExist: true },
    ];

    for (const result of cases) {
      expect(reconciliationClearedPendingCleanup(result)).toBe(false);
    }
  });
});
