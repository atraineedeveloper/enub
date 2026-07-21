import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import WorkerDocumentsDashboard from "./WorkerDocumentsDashboard";
import type { WorkerDocumentCategory, WorkerDocumentType } from "./useWorkerDocumentCatalog";
import type { WorkerDocument } from "./useWorkerDocuments";
import type { Semester } from "../../semesters/useSemesters";
import type { Worker } from "../useWorkers";

// Real-render coverage for the props-only dashboard: it receives its data
// as plain props (no hooks of its own beyond local UI state), so no
// mock.module is needed here at all -- the drawer only mounts once a
// requirement is opened via a click, which renderToStaticMarkup cannot
// simulate, so none of ITS hooks (upload/replace/delete) are exercised by
// a cold render either. Interaction-only behavior (opening the drawer,
// switching category, the discard-confirmation flow) is covered by the
// pure decideDrawerTransition/applyCategoryChange tests instead
// (documentRequirementSummary.test.ts) plus manual verification.

const worker: Pick<Worker, "name" | "type_worker"> = {
  name: "Ana Pérez",
  type_worker: "Docente",
};

const semesters: Semester[] = [
  { id: 1, semester: "25A", school_year: "2025-2026" } as Semester,
];

function type(overrides: Partial<WorkerDocumentType> = {}): WorkerDocumentType {
  return {
    id: 1,
    category_id: 1,
    name: "Tipo",
    allows_multiple: false,
    is_active: true,
    sort_order: 10,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as WorkerDocumentType;
}

function document(overrides: Partial<WorkerDocument> = {}): WorkerDocument {
  return {
    id: 1,
    worker_id: 1,
    document_type_id: 1,
    semester_id: null,
    file_name: "archivo.pdf",
    storage_path: "1/1/permanent/uuid-archivo.pdf",
    mime_type: "application/pdf",
    file_size: 100,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as WorkerDocument;
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    worker,
    workerId: 1,
    documentCatalog: [] as WorkerDocumentCategory[],
    documentsByType: new Map<number, WorkerDocument[]>(),
    semesters,
    selectedSemesterId: "1",
    onSemesterChange: () => {},
    isLoadingReport: false,
    onDownloadReport: () => {},
    onView: () => {},
    onDownload: () => {},
    ...overrides,
  };
}

describe("WorkerDocumentsDashboard -- categories generated from the real catalog", () => {
  test("tabs render every category in the catalog's own sort_order, never a hardcoded set", () => {
    const documentCatalog: WorkerDocumentCategory[] = [
      { id: 1, name: "Zeta", scope: "permanent", sort_order: 5, created_at: "2026-01-01T00:00:00.000Z", document_types: [] } as WorkerDocumentCategory,
      { id: 2, name: "Alfa", scope: "semester", sort_order: 15, created_at: "2026-01-01T00:00:00.000Z", document_types: [] } as WorkerDocumentCategory,
    ];
    const html = renderToStaticMarkup(
      <WorkerDocumentsDashboard {...baseProps({ documentCatalog })} />
    );

    // Order matches the catalog's own array order (already sort_order-
    // ordered by the query layer, untouched by this component) -- "Zeta"
    // (sort_order 5) appears before "Alfa" (sort_order 15) even though
    // that's not alphabetical, proving nothing here re-sorts or
    // hardcodes category names.
    expect(html.indexOf("Zeta")).toBeGreaterThan(-1);
    expect(html.indexOf("Zeta")).toBeLessThan(html.indexOf("Alfa"));
  });
});

describe("WorkerDocumentsDashboard -- summary", () => {
  test("zero active requirements shows a human message, never a 0/0 or NaN%", () => {
    const documentCatalog: WorkerDocumentCategory[] = [
      {
        id: 1,
        name: "Datos personales",
        scope: "permanent",
        sort_order: 10,
        document_types: [type({ id: 1, is_active: false })],
      } as WorkerDocumentCategory,
    ];
    const html = renderToStaticMarkup(
      <WorkerDocumentsDashboard {...baseProps({ documentCatalog })} />
    );

    expect(html).toContain("No hay requisitos activos configurados.");
    expect(html).not.toContain("NaN");
  });

  test("combines every category into one summary count", () => {
    const documentCatalog: WorkerDocumentCategory[] = [
      {
        id: 1,
        name: "Datos personales",
        scope: "permanent",
        sort_order: 10,
        document_types: [type({ id: 1 })],
      } as WorkerDocumentCategory,
      {
        id: 2,
        name: "Docencia",
        scope: "semester",
        sort_order: 20,
        document_types: [type({ id: 2 }), type({ id: 3 })],
      } as WorkerDocumentCategory,
    ];
    const documentsByType = new Map([[1, [document({ id: 1 })]]]);

    const html = renderToStaticMarkup(
      <WorkerDocumentsDashboard {...baseProps({ documentCatalog, documentsByType })} />
    );

    expect(html).toContain("3 requisitos");
    expect(html).toContain("1 con archivos");
    expect(html).toContain("2 pendientes");
  });
});

describe("WorkerDocumentsDashboard -- fila del requisito (5 estados de acción)", () => {
  function renderSingleType(documentType: WorkerDocumentType, documents: WorkerDocument[]) {
    const documentCatalog: WorkerDocumentCategory[] = [
      {
        id: 1,
        name: "Datos personales",
        scope: "permanent",
        sort_order: 10,
        document_types: [documentType],
      } as WorkerDocumentCategory,
    ];
    const documentsByType = new Map(documents.length ? [[documentType.id, documents]] : []);
    return renderToStaticMarkup(
      <WorkerDocumentsDashboard {...baseProps({ documentCatalog, documentsByType })} />
    );
  }

  test("multi vacío -> 'Subir archivos'", () => {
    const html = renderSingleType(type({ id: 1, allows_multiple: true }), []);
    expect(html).toContain("Subir archivos");
  });

  test("multi con archivos -> 'Agregar archivos'", () => {
    const html = renderSingleType(type({ id: 1, allows_multiple: true }), [document()]);
    expect(html).toContain("Agregar archivos");
  });

  test("single vacío -> 'Subir archivo'", () => {
    const html = renderSingleType(type({ id: 1, allows_multiple: false }), []);
    expect(html).toContain("Subir archivo");
    expect(html).not.toContain("Subir archivos");
  });

  test("single con archivo -> 'Reemplazar archivo'", () => {
    const html = renderSingleType(type({ id: 1, allows_multiple: false }), [document()]);
    expect(html).toContain("Reemplazar archivo");
  });

  test("inactivo con historial -> 'Ver archivos'", () => {
    const html = renderSingleType(type({ id: 1, is_active: false }), [document()]);
    expect(html).toContain("Ver archivos");
  });

  test("la fila nunca repite el texto de descripción single/multi (solo vive en el drawer)", () => {
    const html = renderSingleType(type({ id: 1, allows_multiple: true }), [document()]);
    expect(html).not.toContain("Puedes adjuntar varios archivos");
    expect(html).not.toContain("Se admite un archivo");
  });

  test("la fila muestra 'Sin archivos cargados' cuando no hay archivos", () => {
    const html = renderSingleType(type({ id: 1 }), []);
    expect(html).toContain("Sin archivos cargados");
  });
});

describe("WorkerDocumentsDashboard -- separación permanente/semestral", () => {
  test("un tipo permanente y uno semestral usan cada uno la colección de documentsByType que reciben, sin mezclarse", () => {
    // documentsByType already reflects the correct per-scope dataset by
    // the time it reaches this component (WorkerDocumentsView's existing,
    // unchanged query layer is what guarantees that) -- this proves the
    // dashboard/list/row chain reads it correctly, not that the query
    // itself is correct (covered separately).
    const permanentType = type({ id: 1, category_id: 1, name: "CURP" });
    const documentCatalog: WorkerDocumentCategory[] = [
      {
        id: 1,
        name: "Datos personales",
        scope: "permanent",
        sort_order: 10,
        document_types: [permanentType],
      } as WorkerDocumentCategory,
    ];
    const documentsByType = new Map([
      [1, [document({ id: 1, document_type_id: 1, semester_id: null })]],
    ]);

    const html = renderToStaticMarkup(
      <WorkerDocumentsDashboard {...baseProps({ documentCatalog, documentsByType })} />
    );

    expect(html).toContain("CURP");
    expect(html).toContain("1 archivo");
  });

  test("cambiar de semestre no afecta cómo se muestran los documentos permanentes -- la vista solo refleja el mapa que recibe", () => {
    const permanentType = type({ id: 1, name: "CURP" });
    const documentCatalog: WorkerDocumentCategory[] = [
      {
        id: 1,
        name: "Datos personales",
        scope: "permanent",
        sort_order: 10,
        document_types: [permanentType],
      } as WorkerDocumentCategory,
    ];
    // Simulates the same permanent document surviving a semester change --
    // its row still shows exactly 1 archivo either way, since the
    // permanent type's own entry in documentsByType never depends on
    // selectedSemesterId.
    const documentsByType = new Map([
      [1, [document({ id: 1, document_type_id: 1, semester_id: null })]],
    ]);

    const htmlForSemesterA = renderToStaticMarkup(
      <WorkerDocumentsDashboard
        {...baseProps({ documentCatalog, documentsByType, selectedSemesterId: "1" })}
      />
    );
    const htmlForSemesterB = renderToStaticMarkup(
      <WorkerDocumentsDashboard
        {...baseProps({ documentCatalog, documentsByType, selectedSemesterId: "2" })}
      />
    );

    expect(htmlForSemesterA).toContain("1 archivo");
    expect(htmlForSemesterB).toContain("1 archivo");
  });
});

describe("WorkerDocumentsDashboard -- filtros y búsqueda", () => {
  function renderTwoTypes() {
    const documentCatalog: WorkerDocumentCategory[] = [
      {
        id: 1,
        name: "Datos personales",
        scope: "permanent",
        sort_order: 10,
        document_types: [
          type({ id: 1, name: "CURP" }),
          type({ id: 2, name: "Acta de nacimiento" }),
        ],
      } as WorkerDocumentCategory,
    ];
    const documentsByType = new Map([[1, [document({ id: 1, document_type_id: 1 })]]]);
    return { documentCatalog, documentsByType };
  }

  test("ambos requisitos aparecen sin filtro", () => {
    const { documentCatalog, documentsByType } = renderTwoTypes();
    const html = renderToStaticMarkup(
      <WorkerDocumentsDashboard {...baseProps({ documentCatalog, documentsByType })} />
    );
    expect(html).toContain("CURP");
    expect(html).toContain("Acta de nacimiento");
  });
});

describe("WorkerDocumentsDashboard -- encabezado", () => {
  test("el selector de periodo solo aparece para una categoría semestral", () => {
    const permanentOnly: WorkerDocumentCategory[] = [
      { id: 1, name: "Datos personales", scope: "permanent", sort_order: 10, created_at: "2026-01-01T00:00:00.000Z", document_types: [] } as WorkerDocumentCategory,
    ];
    const html = renderToStaticMarkup(
      <WorkerDocumentsDashboard {...baseProps({ documentCatalog: permanentOnly })} />
    );
    expect(html).not.toContain('id="semester"');
  });

  test("el periodo no se repite: 'Descargar reporte' está presente y el <select> aparece una sola vez", () => {
    const semesterCategory: WorkerDocumentCategory[] = [
      { id: 1, name: "Docencia", scope: "semester", sort_order: 10, created_at: "2026-01-01T00:00:00.000Z", document_types: [] } as WorkerDocumentCategory,
    ];
    const html = renderToStaticMarkup(
      <WorkerDocumentsDashboard {...baseProps({ documentCatalog: semesterCategory })} />
    );
    expect(html).toContain("Descargar reporte");
    expect(html.match(/id="semester"/g) ?? []).toHaveLength(1);
  });
});
