import { describe, expect, test } from "bun:test";
import type { MyDateOfAdmission, MySustenancePlaza } from "../../services/apiWorkers";
import {
  formatCivilDate,
  formatDateOfAdmissionType,
  formatDateOfAdmissionValue,
  formatOptionalWorkerField,
  formatWorkerType,
  parseCivilDate,
  sortDateOfAdmissions,
  sortSustenancePlazas,
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

describe("parseCivilDate (real calendar validation, no Date object)", () => {
  test("2024-02-29 is valid -- 2024 is a leap year (divisible by 4, not by 100)", () => {
    expect(parseCivilDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
  });

  test("2023-02-29 is invalid -- 2023 is not a leap year", () => {
    expect(parseCivilDate("2023-02-29")).toBeNull();
  });

  test("2024-02-30 is invalid -- February never has 30 days, leap year or not", () => {
    expect(parseCivilDate("2024-02-30")).toBeNull();
  });

  test("2024-04-31 is invalid -- April has 30 days", () => {
    expect(parseCivilDate("2024-04-31")).toBeNull();
  });

  test("2024-04-30 is valid -- April's real last day", () => {
    expect(parseCivilDate("2024-04-30")).toEqual({ year: 2024, month: 4, day: 30 });
  });

  test("2000-02-29 is valid -- divisible by 400, the exception-to-the-exception century rule", () => {
    expect(parseCivilDate("2000-02-29")).toEqual({ year: 2000, month: 2, day: 29 });
  });

  test("1900-02-29 is invalid -- divisible by 100 but not by 400, so NOT a leap year despite being divisible by 4", () => {
    expect(parseCivilDate("1900-02-29")).toBeNull();
  });

  test("every other month's real last day is valid, and one day past it is not", () => {
    const lastDayOfMonth: Record<string, number> = {
      "01": 31, "03": 31, "05": 31, "06": 30, "07": 31,
      "08": 31, "09": 30, "10": 31, "11": 30, "12": 31,
    };
    for (const [month, lastDay] of Object.entries(lastDayOfMonth)) {
      expect(parseCivilDate(`2024-${month}-${String(lastDay).padStart(2, "0")}`)).not.toBeNull();
      expect(parseCivilDate(`2024-${month}-${String(lastDay + 1).padStart(2, "0")}`)).toBeNull();
    }
  });

  test("malformed values return null, never throw", () => {
    expect(parseCivilDate("not-a-date")).toBeNull();
    expect(parseCivilDate("2024-13-01")).toBeNull();
    expect(parseCivilDate("2024-00-01")).toBeNull();
    expect(parseCivilDate("2024-08-00")).toBeNull();
    expect(parseCivilDate("2024-08-32")).toBeNull();
    expect(parseCivilDate("2024-8-16")).toBeNull(); // must be exactly 2-digit month
    expect(parseCivilDate("2024-08-16T00:00:00Z")).toBeNull();
    expect(parseCivilDate(null)).toBeNull();
    expect(parseCivilDate(undefined)).toBeNull();
    expect(parseCivilDate("")).toBeNull();
  });

  test("month is 1-12 (real calendar month), not a zero-based JS Date index", () => {
    expect(parseCivilDate("2024-01-01")?.month).toBe(1);
    expect(parseCivilDate("2024-12-01")?.month).toBe(12);
  });
});

describe("formatCivilDate (YYYY-MM-DD -> Spanish civil date, no timezone shift)", () => {
  test("a real date formats as 'D de <mes> de YYYY'", () => {
    expect(formatCivilDate("2024-08-16")).toBe("16 de agosto de 2024");
  });

  test("every month name is correct", () => {
    expect(formatCivilDate("2024-01-01")).toBe("1 de enero de 2024");
    expect(formatCivilDate("2024-02-01")).toBe("1 de febrero de 2024");
    expect(formatCivilDate("2024-03-01")).toBe("1 de marzo de 2024");
    expect(formatCivilDate("2024-04-01")).toBe("1 de abril de 2024");
    expect(formatCivilDate("2024-05-01")).toBe("1 de mayo de 2024");
    expect(formatCivilDate("2024-06-01")).toBe("1 de junio de 2024");
    expect(formatCivilDate("2024-07-01")).toBe("1 de julio de 2024");
    expect(formatCivilDate("2024-08-01")).toBe("1 de agosto de 2024");
    expect(formatCivilDate("2024-09-01")).toBe("1 de septiembre de 2024");
    expect(formatCivilDate("2024-10-01")).toBe("1 de octubre de 2024");
    expect(formatCivilDate("2024-11-01")).toBe("1 de noviembre de 2024");
    expect(formatCivilDate("2024-12-01")).toBe("1 de diciembre de 2024");
  });

  test("the day is never shifted by a day, unlike naive `new Date(value)` parsing", () => {
    // The classic bug: `new Date("2024-08-16")` parses as UTC midnight;
    // formatting it in any timezone behind UTC (all of Mexico) would show
    // "15 de agosto". This function must never reproduce that.
    expect(formatCivilDate("2024-08-16")).not.toContain("15 de agosto");
    expect(formatCivilDate("2024-01-01")).not.toContain("31 de diciembre");
    expect(formatCivilDate("2024-12-31")).toBe("31 de diciembre de 2024");
  });

  test("a single-digit day/month input is still valid ('YYYY-MM-DD' always has 2-digit month/day)", () => {
    expect(formatCivilDate("2024-08-05")).toBe("5 de agosto de 2024");
  });

  test("null, undefined, and an empty string return null", () => {
    expect(formatCivilDate(null)).toBeNull();
    expect(formatCivilDate(undefined)).toBeNull();
    expect(formatCivilDate("")).toBeNull();
  });

  test("a value with a time/timezone component is rejected, not partially parsed", () => {
    expect(formatCivilDate("2024-08-16T00:00:00Z")).toBeNull();
    expect(formatCivilDate("2024-08-16 00:00:00")).toBeNull();
  });

  test("a malformed or out-of-range value returns null, never throws", () => {
    expect(formatCivilDate("not-a-date")).toBeNull();
    expect(formatCivilDate("2024-13-01")).toBeNull();
    expect(formatCivilDate("2024-00-01")).toBeNull();
    expect(formatCivilDate("2024-08-00")).toBeNull();
    expect(formatCivilDate("2024-08-32")).toBeNull();
  });

  test("uses real calendar validation (via parseCivilDate), not just digit-shape matching", () => {
    expect(formatCivilDate("2024-02-29")).toBe("29 de febrero de 2024"); // leap year
    expect(formatCivilDate("2023-02-29")).toBeNull(); // not a leap year
    expect(formatCivilDate("2024-04-31")).toBeNull(); // April has 30 days
    expect(formatCivilDate("2000-02-29")).toBe("29 de febrero de 2000"); // divisible by 400
    expect(formatCivilDate("1900-02-29")).toBeNull(); // divisible by 100, not 400
  });
});

describe("formatDateOfAdmissionValue (civil date or exact fallback)", () => {
  test("a real date is formatted", () => {
    expect(formatDateOfAdmissionValue("2020-01-01")).toBe("1 de enero de 2020");
  });

  test("null -> 'Fecha no registrada', never blank or 'null'", () => {
    expect(formatDateOfAdmissionValue(null)).toBe("Fecha no registrada");
  });

  test("an unparseable value -> 'Fecha no registrada'", () => {
    expect(formatDateOfAdmissionValue("garbage")).toBe("Fecha no registrada");
  });
});

describe("formatDateOfAdmissionType (consistent with formatWorkerType's wording)", () => {
  test("a real value passes through unchanged", () => {
    expect(formatDateOfAdmissionType("SEP")).toBe("SEP");
  });

  test("null -> 'Tipo no especificado'", () => {
    expect(formatDateOfAdmissionType(null)).toBe("Tipo no especificado");
  });
});

describe("sortSustenancePlazas (deterministic order, independent of input/DB order)", () => {
  const plaza = (overrides: Partial<MySustenancePlaza>): MySustenancePlaza => ({
    sustenance: null,
    payment_key: null,
    plaza: null,
    ...overrides,
  });

  test("orders by sustenance, then plaza, then payment_key", () => {
    const federalA = plaza({ sustenance: "Federal", plaza: "A", payment_key: "1" });
    const estatalB = plaza({ sustenance: "Estatal", plaza: "B", payment_key: "1" });
    const estatalA2 = plaza({ sustenance: "Estatal", plaza: "A", payment_key: "2" });
    const estatalA1 = plaza({ sustenance: "Estatal", plaza: "A", payment_key: "1" });

    const sorted = sortSustenancePlazas([federalA, estatalB, estatalA2, estatalA1]);

    expect(sorted).toEqual([estatalA1, estatalA2, estatalB, federalA]);
  });

  test("the exact same set of plazas sorts identically regardless of input order", () => {
    const a = plaza({ sustenance: "Estatal", plaza: "1A", payment_key: "K1" });
    const b = plaza({ sustenance: "Federal", plaza: "2B", payment_key: "K2" });
    const c = plaza({ sustenance: "Estatal", plaza: "3C", payment_key: "K3" });

    const sortedForward = sortSustenancePlazas([a, b, c]);
    const sortedReversed = sortSustenancePlazas([c, b, a]);

    expect(sortedForward).toEqual(sortedReversed);
  });

  test("a missing sustenance/plaza/payment_key sorts after every real value in that key", () => {
    const withValue = plaza({ sustenance: "Estatal" });
    const withoutValue = plaza({ sustenance: null });

    expect(sortSustenancePlazas([withoutValue, withValue])).toEqual([
      withValue,
      withoutValue,
    ]);
  });

  test("does not mutate the input array", () => {
    const original = [plaza({ sustenance: "Federal" }), plaza({ sustenance: "Estatal" })];
    const originalCopy = [...original];

    sortSustenancePlazas(original);

    expect(original).toEqual(originalCopy);
  });

  test("zero, one, and multiple plazas all sort without error", () => {
    expect(sortSustenancePlazas([])).toEqual([]);
    expect(sortSustenancePlazas([plaza({ sustenance: "Estatal" })])).toHaveLength(1);
    expect(
      sortSustenancePlazas([
        plaza({ sustenance: "Federal" }),
        plaza({ sustenance: "Estatal" }),
        plaza({ sustenance: "Estatal", plaza: "Z" }),
      ])
    ).toHaveLength(3);
  });
});

describe("sortDateOfAdmissions (deterministic chronological order, independent of input/DB order)", () => {
  const admission = (
    overrides: Partial<MyDateOfAdmission>
  ): MyDateOfAdmission => ({
    type: null,
    date_of_admission: null,
    ...overrides,
  });

  test("orders chronologically ascending by date_of_admission", () => {
    const latest = admission({ type: "C", date_of_admission: "2024-08-01" });
    const earliest = admission({ type: "A", date_of_admission: "2020-01-01" });
    const middle = admission({ type: "B", date_of_admission: "2022-06-15" });

    expect(sortDateOfAdmissions([latest, earliest, middle])).toEqual([
      earliest,
      middle,
      latest,
    ]);
  });

  test("the exact same set sorts identically regardless of input order", () => {
    const a = admission({ date_of_admission: "2021-01-01" });
    const b = admission({ date_of_admission: "2023-01-01" });
    const c = admission({ date_of_admission: "2022-01-01" });

    expect(sortDateOfAdmissions([a, b, c])).toEqual(sortDateOfAdmissions([c, a, b]));
  });

  test("a missing or unparseable date sorts after every real date", () => {
    const withDate = admission({ date_of_admission: "2020-01-01" });
    const withoutDate = admission({ date_of_admission: null });
    const malformedDate = admission({ date_of_admission: "not-a-date" });

    const sorted = sortDateOfAdmissions([withoutDate, withDate, malformedDate]);

    expect(sorted[0]).toEqual(withDate);
    expect(sorted.slice(1)).toEqual(
      expect.arrayContaining([withoutDate, malformedDate])
    );
  });

  test("a shape-valid but calendar-invalid date (e.g. '2024-04-31', which doesn't exist) sorts last, same as null", () => {
    const realDate = admission({ type: "Real", date_of_admission: "2020-01-01" });
    const nonexistentDate = admission({ type: "Fake", date_of_admission: "2024-04-31" });

    const sorted = sortDateOfAdmissions([nonexistentDate, realDate]);

    // Without real calendar validation, "2024-04-31" would sort as if it
    // were a genuine date *after* 2020-01-01 by plain string comparison --
    // it must instead be treated exactly like an invalid/missing date.
    expect(sorted).toEqual([realDate, nonexistentDate]);
  });

  test("two identical dates tie-break by type", () => {
    const sameDataB = admission({ type: "B", date_of_admission: "2020-01-01" });
    const sameDateA = admission({ type: "A", date_of_admission: "2020-01-01" });

    expect(sortDateOfAdmissions([sameDataB, sameDateA])).toEqual([
      sameDateA,
      sameDataB,
    ]);
  });

  test("does not mutate the input array", () => {
    const original = [
      admission({ date_of_admission: "2024-01-01" }),
      admission({ date_of_admission: "2020-01-01" }),
    ];
    const originalCopy = [...original];

    sortDateOfAdmissions(original);

    expect(original).toEqual(originalCopy);
  });

  test("zero, one, and multiple dates all sort without error", () => {
    expect(sortDateOfAdmissions([])).toEqual([]);
    expect(sortDateOfAdmissions([admission({ date_of_admission: "2020-01-01" })])).toHaveLength(1);
    expect(
      sortDateOfAdmissions([
        admission({ date_of_admission: "2020-01-01" }),
        admission({ date_of_admission: "2021-01-01" }),
        admission({ date_of_admission: "2022-01-01" }),
      ])
    ).toHaveLength(3);
  });
});
