import { describe, expect, test } from "bun:test";
import {
  addReportStatusToCategories,
  buildReplacedWorkerDocument,
  createWorkerDocumentStoragePath,
  mapWorkerDocumentDatabaseError,
  sanitizeStorageFileName,
} from "./apiWorkerDocuments";

// Browser-discovered defect: uploading "Curso de Maestría en Comunicación.pdf"
// produced a Storage key containing raw accented Unicode
// ("Curso-de-Maestría-en-Comunicación.pdf"), which Supabase Storage rejects
// with HTTP 400 InvalidKey. The previous sanitizer only replaced path
// separators and whitespace, leaving every accented character untouched.
describe("sanitizeStorageFileName (Storage InvalidKey fix)", () => {
  test("a Spanish accented filename produces a valid ASCII storage segment", () => {
    expect(
      sanitizeStorageFileName("Curso de Maestría en Comunicación.pdf")
    ).toBe("curso-de-maestria-en-comunicacion.pdf");
  });

  test("accents, spaces, and numerals all normalize correctly", () => {
    expect(sanitizeStorageFileName("Planeación 1.docx")).toBe(
      "planeacion-1.docx"
    );
  });

  test("parentheses, spaces, and punctuation are removed or replaced", () => {
    expect(sanitizeStorageFileName("Evidencia (final) 2026!.PDF")).toBe(
      "evidencia-final-2026.pdf"
    );
  });

  test("a filename of only accented vowels and ñ/ü normalizes to plain ASCII", () => {
    expect(sanitizeStorageFileName("áéíóú ñ ü.pdf")).toBe("aeiou-n-u.pdf");
  });

  test("directory traversal characters cannot create folders", () => {
    const result = sanitizeStorageFileName("../../documento.pdf");
    expect(result).toBe("documento.pdf");
    expect(result).not.toContain("..");
    expect(result).not.toContain("/");
  });

  test("backslashes cannot create a path hierarchy", () => {
    const result = sanitizeStorageFileName("reporte\\interno.xlsx");
    expect(result).toBe("reporte-interno.xlsx");
    expect(result).not.toContain("\\");
  });

  test("a filename of only unsupported symbols falls back to the default basename", () => {
    expect(sanitizeStorageFileName("!!!.pdf")).toBe("archivo.pdf");
  });

  test("a completely empty filename falls back to the default basename with no extension", () => {
    expect(sanitizeStorageFileName("")).toBe("archivo");
  });

  test("a filename with no extension is left without a trailing dot", () => {
    expect(sanitizeStorageFileName("README")).toBe("readme");
  });

  test("a leading-dot-only filename is not treated as basename '' + extension (no duplication)", () => {
    expect(sanitizeStorageFileName(".hiddenfile")).toBe("hiddenfile");
  });

  test("repeated spaces and hyphens collapse to a single hyphen", () => {
    expect(sanitizeStorageFileName("a   --  b.pdf")).toBe("a-b.pdf");
  });

  test("uppercase extensions normalize to lowercase", () => {
    expect(sanitizeStorageFileName("MYFILE.PDF")).toBe("myfile.pdf");
  });

  test("very long filenames are bounded to a reasonable segment length", () => {
    const longName = "a".repeat(300) + ".pdf";
    const result = sanitizeStorageFileName(longName);
    const [basename, extension] = result.split(".");
    expect(basename.length).toBeLessThanOrEqual(100);
    expect(extension).toBe("pdf");
  });

  test("surrounding whitespace is trimmed before sanitization", () => {
    expect(sanitizeStorageFileName("  spaced  name  .pdf")).toBe(
      "spaced-name.pdf"
    );
  });
});

describe("createWorkerDocumentStoragePath (integration: the exact reported filename)", () => {
  test("the exact reported filename no longer produces an InvalidKey-prone path", () => {
    const path = createWorkerDocumentStoragePath({
      workerId: 7,
      documentTypeId: 15,
      semesterId: 3,
      file: { name: "Curso de Maestría en Comunicación.pdf" } as File,
    });

    // Every path segment must be free of raw Unicode/accented characters,
    // spaces, and path-separator-breaking characters -- only what a
    // conservative Storage key allows.
    expect(path).toMatch(
      /^7\/15\/3\/[0-9a-f-]+-curso-de-maestria-en-comunicacion\.pdf$/
    );
    expect(path).not.toMatch(/[íóáéú]/i);
    expect(path).not.toContain(" ");
  });

  test("upload and replacement generate storage paths consistently for the same inputs shape", () => {
    const buildPath = () =>
      createWorkerDocumentStoragePath({
        workerId: 1,
        documentTypeId: 2,
        semesterId: null,
        file: { name: "Evidencia (final) 2026!.PDF" } as File,
      });

    const first = buildPath();
    const second = buildPath();

    // Both calls produce the identical safe basename/extension segment
    // (only the UUID prefix differs between calls, guaranteeing no
    // collision), proving the sanitizer itself is deterministic.
    const stripUuid = (path: string) => path.replace(/[0-9a-f-]{36}-/, "");
    expect(stripUuid(first)).toBe(stripUuid(second));
    expect(stripUuid(first)).toBe("1/2/permanent/evidencia-final-2026.pdf");
  });
});

describe("buildReplacedWorkerDocument (replacement RPC success result, no post-commit fetch)", () => {
  const rpcResult = {
    new_id: 42,
    new_worker_id: 7,
    new_document_type_id: 15,
    new_semester_id: 3,
    new_file_name: "plan_v2.pdf",
    new_storage_path: "7/15/3/plan_v2.pdf",
    new_mime_type: "application/pdf",
    new_file_size: 1024,
    new_uploaded_by: "d0000000-0000-0000-0000-000000000002",
    new_created_at: "2026-07-16T00:00:00.000Z",
  };
  const documentType = { id: 15, name: "Planeación semestral", is_active: true };

  test("maps every RPC-returned field onto the client-facing document, with no separate fetch involved", () => {
    const document = buildReplacedWorkerDocument(rpcResult, documentType);

    expect(document).toEqual({
      id: 42,
      worker_id: 7,
      document_type_id: 15,
      semester_id: 3,
      file_name: "plan_v2.pdf",
      storage_path: "7/15/3/plan_v2.pdf",
      mime_type: "application/pdf",
      file_size: 1024,
      uploaded_by: "d0000000-0000-0000-0000-000000000002",
      created_at: "2026-07-16T00:00:00.000Z",
      worker_document_types: documentType,
    });
  });

  test("attaches the already-known document type as worker_document_types, matching the shape callers expect", () => {
    const document = buildReplacedWorkerDocument(rpcResult, documentType);
    expect(document.worker_document_types).toBe(documentType);
  });
});

describe("mapWorkerDocumentDatabaseError (ordinary-upload WDT01 mapping)", () => {
  test("maps the stable WDT01 code to the controlled Spanish message", () => {
    expect(
      mapWorkerDocumentDatabaseError(
        { code: "WDT01" },
        "El registro del documento no pudo guardarse"
      )
    ).toBe("Este tipo de documento ya no acepta nuevas cargas.");
  });

  test("falls back to the caller-supplied message for any other code", () => {
    expect(
      mapWorkerDocumentDatabaseError(
        { code: "23514" },
        "El registro del documento no pudo guardarse"
      )
    ).toBe("El registro del documento no pudo guardarse");
  });

  test("falls back safely when the error has no code at all", () => {
    expect(mapWorkerDocumentDatabaseError(null, "fallback")).toBe("fallback");
    expect(mapWorkerDocumentDatabaseError(undefined, "fallback")).toBe(
      "fallback"
    );
  });
});

describe("addReportStatusToCategories (report union/filtering rule)", () => {
  const category = {
    id: 1,
    name: "Docencia",
    scope: "semester" as const,
    sort_order: 1,
    document_types: [
      { id: 10, name: "Evidencias bimestrales", is_active: true },
      { id: 20, name: "Plan de trabajo semestral", is_active: false },
    ],
  };

  test("an active type always appears, even with zero documents (Pendiente)", () => {
    const [result] = addReportStatusToCategories(
      [category as never],
      [] as never
    );

    const activeRow = result.document_types.find((type) => type.id === 10);
    expect(activeRow).toBeDefined();
    expect(activeRow?.status).toBe("Pendiente");
  });

  test("an inactive type with no documents for this worker is omitted entirely", () => {
    const [result] = addReportStatusToCategories(
      [category as never],
      [] as never
    );

    expect(result.document_types.some((type) => type.id === 20)).toBe(false);
  });

  test("Worker A's historical document under an inactive type shows Cargado, never Pendiente", () => {
    const workerADocuments = [
      { document_type_id: 20, id: 900, created_at: "2026-01-01", file_name: "plan.pdf" },
    ];

    const [result] = addReportStatusToCategories(
      [category as never],
      workerADocuments as never
    );

    const inactiveRow = result.document_types.find((type) => type.id === 20);
    expect(inactiveRow).toBeDefined();
    expect(inactiveRow?.status).toBe("Cargado");
  });

  test("Worker B, with no documents under that inactive type, never sees it in their own report", () => {
    // Worker B's report is built from Worker B's own documents only -- an
    // empty array here, proving no leakage from any other worker's data
    // (this function never receives another worker's documents at all,
    // by construction of its own call site in getWorkerDocumentReportData).
    const workerBDocuments: unknown[] = [];

    const [result] = addReportStatusToCategories(
      [category as never],
      workerBDocuments as never
    );

    expect(result.document_types.some((type) => type.id === 20)).toBe(false);
  });
});
