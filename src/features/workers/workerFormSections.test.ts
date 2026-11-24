import { describe, expect, test } from "bun:test";
import { firstInvalidWorkerSection, WORKER_FORM_SECTIONS } from "./workerFormSections";

describe("worker form sections", () => {
  test("routes errors to the first affected section", () => {
    expect(firstInvalidWorkerSection({ city: {}, specialty: {} })).toBe("contact");
    expect(firstInvalidWorkerSection({ sustenance_plazas: [] })).toBe("relations");
    expect(firstInvalidWorkerSection({})).toBeUndefined();
  });
  test("does not assign a field to multiple sections", () => {
    const fields = WORKER_FORM_SECTIONS.flatMap(s => s.fields);
    expect(new Set(fields).size).toBe(fields.length);
  });
});
