import { describe, expect, test } from "bun:test";
import { formatTeacherSchedulePlazas } from "./teacherSchedulePlazas";

describe("teacher schedule PDF plaza header", () => {
  test("preserves every plaza and its corresponding payment key", () => {
    expect(formatTeacherSchedulePlazas([
      { plaza: "P1", payment_key: "001" },
      { plaza: "P2", payment_key: "002" },
    ])).toEqual([
      "PLAZA: P1     CLAVE DE PAGO: 001",
      "PLAZA: P2     CLAVE DE PAGO: 002",
    ]);
  });
  test("handles missing and blank values", () => {
    expect(formatTeacherSchedulePlazas([])).toEqual(["PLAZA Y CLAVE DE PAGO: No registradas"]);
    expect(formatTeacherSchedulePlazas([{ plaza: null, payment_key: "  " }]))
      .toEqual(["PLAZA: No registrada     CLAVE DE PAGO: No registrada"]);
  });
});
