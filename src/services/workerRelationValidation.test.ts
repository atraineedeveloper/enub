import { describe, expect, test } from "bun:test";
import { validateWorkerRelations } from "./workerRelationValidation";

describe("worker relation validation", () => {
  test("preserves omitted relations and accepts explicit clearing", () => {
    expect(validateWorkerRelations()).toBeUndefined();
    expect(validateWorkerRelations([], [{ type: "", date_of_admission: "" }])).toEqual([]);
  });
  test("rejects incomplete and duplicate plazas", () => {
    expect(() => validateWorkerRelations([{ payment_key: "A" }])).toThrow();
    const row = { sustenance: "Federal", payment_key: "A", plaza: "1" };
    expect(() => validateWorkerRelations([row, { ...row, payment_key: " A " }])).toThrow("repetidas");
  });
  test("rejects invalid calendar dates and duplicate admission types", () => {
    expect(() => validateWorkerRelations([], [{ type: "SEP", date_of_admission: "2026-02-30" }])).toThrow();
    expect(() => validateWorkerRelations([], [{ type: "SEP", date_of_admission: "2024-02-29" }, { type: " sep ", date_of_admission: "2025-01-01" }])).toThrow("repetidos");
  });
  test("preserves historical admission labels", () => {
    expect(validateWorkerRelations([], [{ type: "Ingreso", date_of_admission: "2024-02-29" }])).toEqual([{ type: "Ingreso", date_of_admission: "2024-02-29" }]);
  });
});
