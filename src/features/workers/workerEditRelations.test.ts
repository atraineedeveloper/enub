import { describe, expect, test } from "bun:test";
import { selectChangedWorkerRelations } from "./workerEditRelations";

describe("selectChangedWorkerRelations", () => {
  const values = {
    sustenance_plazas: [
      { sustenance: "Estatal", payment_key: "01", plaza: "Base" },
    ],
    date_of_admissions: [
      { type: "Ingreso", date_of_admission: "2020-01-01" },
    ],
  };

  test("a basic-only edit preserves plazas and admission dates", () => {
    expect(selectChangedWorkerRelations({}, values)).toEqual({
      sustenancePlazas: undefined,
      dateOfAdmissions: undefined,
    });
  });

  test("a changed plaza section is included", () => {
    expect(
      selectChangedWorkerRelations({ sustenance_plazas: true }, values)
    ).toEqual({
      sustenancePlazas: values.sustenance_plazas,
      dateOfAdmissions: undefined,
    });
  });

  test("an explicitly emptied plaza section remains an empty array", () => {
    expect(
      selectChangedWorkerRelations(
        { sustenance_plazas: true },
        { ...values, sustenance_plazas: [] }
      ).sustenancePlazas
    ).toEqual([]);
  });

  test("changed admission dates are included and blank placeholder rows removed", () => {
    expect(
      selectChangedWorkerRelations(
        { date_of_admissions: true },
        {
          ...values,
          date_of_admissions: [
            ...values.date_of_admissions,
            { type: "", date_of_admission: "" },
          ],
        }
      ).dateOfAdmissions
    ).toEqual(values.date_of_admissions);
  });

  test("an explicitly emptied admission-date section remains an empty array", () => {
    expect(
      selectChangedWorkerRelations(
        { date_of_admissions: true },
        { ...values, date_of_admissions: [] }
      ).dateOfAdmissions
    ).toEqual([]);
  });
});
