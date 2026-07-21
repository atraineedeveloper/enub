import { describe, expect, test } from "bun:test";
import { buildReportRows } from "./generateWorkerDocumentReportPdf";
import type { WorkerDocumentReportCategory } from "./useWorkerDocumentReportData";

// Regression coverage (Item 21): the report already handled multiple
// documents per type correctly before the Docencia multi-file redesign --
// this pins that behavior down explicitly for a newly-multi Docencia type,
// so a future change can't silently regress it back to one row per type.

function makeCategory(
  overrides: Partial<WorkerDocumentReportCategory> = {}
): WorkerDocumentReportCategory {
  return {
    id: 2,
    name: "Docencia",
    scope: "semester",
    sort_order: 20,
    document_types: [],
    ...overrides,
  } as WorkerDocumentReportCategory;
}

describe("buildReportRows -- multiple documents per type (Docencia multi-file)", () => {
  test("a Docencia type with 3 uploaded files produces 3 separate rows, not 1 collapsed row", () => {
    const categories = [
      makeCategory({
        document_types: [
          {
            id: 60,
            category_id: 2,
            name: "Rúbricas",
            allows_multiple: true,
            is_active: true,
            sort_order: 40,
            status: "Cargado",
            uploaded_at: "2026-01-01T00:00:00.000Z",
            file_name: "rubrica-1.pdf",
            documents: [
              { id: 1, file_name: "rubrica-1.pdf", created_at: "2026-01-01T00:00:00.000Z" },
              { id: 2, file_name: "rubrica-2.pdf", created_at: "2026-02-01T00:00:00.000Z" },
              { id: 3, file_name: "rubrica-3.pdf", created_at: "2026-03-01T00:00:00.000Z" },
            ],
          } as never,
        ],
      }),
    ];

    const rows = buildReportRows(categories);

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row[0] === "Docencia" && row[1] === "Rúbricas")).toBe(true);
    expect(rows.every((row) => row[2] === "Cargado")).toBe(true);
    expect(rows.map((row) => row[3])).toEqual(["rubrica-1.pdf", "rubrica-2.pdf", "rubrica-3.pdf"]);
  });

  test("a type with zero documents still produces exactly one 'Pendiente' row, not zero rows", () => {
    const categories = [
      makeCategory({
        document_types: [
          {
            id: 61,
            category_id: 2,
            name: "Listas de asistencia",
            allows_multiple: true,
            is_active: true,
            sort_order: 70,
            status: "Pendiente",
            uploaded_at: null,
            file_name: null,
            documents: [],
          } as never,
        ],
      }),
    ];

    const rows = buildReportRows(categories);

    expect(rows).toEqual([
      ["Docencia", "Listas de asistencia", "Pendiente", "Sin archivo", ""],
    ]);
  });

  test("a single-file type with one document still produces exactly one row (unchanged shape)", () => {
    const categories = [
      makeCategory({
        document_types: [
          {
            id: 62,
            category_id: 2,
            name: "Planeación semestral",
            allows_multiple: false,
            is_active: true,
            sort_order: 10,
            status: "Cargado",
            uploaded_at: "2026-01-01T00:00:00.000Z",
            file_name: "plan.pdf",
            documents: [
              { id: 5, file_name: "plan.pdf", created_at: "2026-01-01T00:00:00.000Z" },
            ],
          } as never,
        ],
      }),
    ];

    expect(buildReportRows(categories)).toHaveLength(1);
  });

  test("multiple document types across multiple categories all flatten into one row list", () => {
    const categories = [
      makeCategory({
        id: 1,
        name: "Datos personales",
        document_types: [
          {
            id: 1,
            name: "CURP",
            status: "Pendiente",
            documents: [],
          } as never,
        ],
      }),
      makeCategory({
        document_types: [
          {
            id: 60,
            name: "Rúbricas",
            status: "Cargado",
            documents: [
              { id: 1, file_name: "a.pdf", created_at: "2026-01-01T00:00:00.000Z" },
              { id: 2, file_name: "b.pdf", created_at: "2026-01-02T00:00:00.000Z" },
            ],
          } as never,
        ],
      }),
    ];

    const rows = buildReportRows(categories);
    expect(rows).toHaveLength(3);
    expect(rows[0][0]).toBe("Datos personales");
    expect(rows[1][0]).toBe("Docencia");
    expect(rows[2][0]).toBe("Docencia");
  });
});
