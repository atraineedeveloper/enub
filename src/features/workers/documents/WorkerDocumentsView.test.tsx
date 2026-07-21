import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Worker } from "../useWorkers";
import type { WorkerDocumentCategory } from "./useWorkerDocumentCatalog";
import type { WorkerDocument } from "./useWorkerDocuments";
import type { Semester } from "../../semesters/useSemesters";

// Thin-wrapper coverage: WorkerDocumentsView now only owns data
// fetching/loading/error and computing documentsByType -- every
// interactive dashboard/list/drawer concern lives in
// WorkerDocumentsDashboard (WorkerDocumentsDashboard.test.tsx), which
// receives plain props here, not hooks. A cold render never opens the
// drawer, so none of the drawer's own mutation hooks need mocking for
// this file.

let nextWorker: { isLoading: boolean; worker: Worker | null; error: unknown } = {
  isLoading: false,
  worker: null,
  error: null,
};
let nextCatalog: {
  isLoading: boolean;
  documentCatalog: WorkerDocumentCategory[] | undefined;
  error: unknown;
} = { isLoading: false, documentCatalog: undefined, error: null };
let nextSemesters: {
  isLoading: boolean;
  semesters: Semester[] | undefined;
  error: unknown;
} = { isLoading: false, semesters: [], error: null };
let nextAllDocuments: {
  isLoading: boolean;
  workerDocuments: WorkerDocument[] | undefined;
  error: unknown;
} = { isLoading: false, workerDocuments: [], error: null };
let nextSemesterDocuments: {
  isLoading: boolean;
  workerDocuments: WorkerDocument[] | undefined;
  error: unknown;
} = { isLoading: false, workerDocuments: [], error: null };

mock.module("../useWorker", () => ({ useWorker: () => nextWorker }));
mock.module("./useWorkerDocumentCatalog", () => ({
  useWorkerDocumentCatalog: () => nextCatalog,
}));
mock.module("../../semesters/useSemesters", () => ({
  useSemesters: () => nextSemesters,
}));
mock.module("./useWorkerDocuments", () => ({
  useWorkerDocuments: () => nextAllDocuments,
}));
mock.module("./useWorkerDocumentsBySemester", () => ({
  useWorkerDocumentsBySemester: () => nextSemesterDocuments,
}));
mock.module("./useWorkerDocumentReportData", () => ({
  useWorkerDocumentReportData: () => ({
    isLoading: false,
    reportData: null,
    error: null,
  }),
}));

const { default: WorkerDocumentsView } = await import("./WorkerDocumentsView");

const worker: Worker = {
  id: 1,
  name: "Ana Pérez",
  type_worker: "Docente",
} as Worker;

const semesters: Semester[] = [
  { id: 1, semester: "25A", school_year: "2025-2026" } as Semester,
];

function buildCatalog(): WorkerDocumentCategory[] {
  return [
    {
      id: 1,
      name: "Datos personales",
      scope: "permanent",
      sort_order: 10,
      document_types: [
        {
          id: 100,
          category_id: 1,
          name: "CURP",
          allows_multiple: false,
          is_active: true,
          sort_order: 10,
        },
      ],
    } as WorkerDocumentCategory,
  ];
}

function setFixtures() {
  nextWorker = { isLoading: false, worker, error: null };
  nextCatalog = { isLoading: false, documentCatalog: buildCatalog(), error: null };
  nextSemesters = { isLoading: false, semesters, error: null };
  nextAllDocuments = { isLoading: false, workerDocuments: [], error: null };
  nextSemesterDocuments = { isLoading: false, workerDocuments: [], error: null };
}

describe("WorkerDocumentsView -- data shell renders the dashboard once loaded", () => {
  test("renders the page header with worker name/type and the catalog's requirements", () => {
    setFixtures();
    const html = renderToStaticMarkup(<WorkerDocumentsView workerId={1} />);

    expect(html).toContain("Expediente documental");
    expect(html).toContain("Ana Pérez");
    expect(html).toContain("Docente");
    expect(html).toContain("CURP");
  });
});

describe("WorkerDocumentsView -- loading and error states", () => {
  test("loading state renders a spinner, not the catalog", () => {
    nextWorker = { isLoading: true, worker: null, error: null };
    nextCatalog = { isLoading: false, documentCatalog: undefined, error: null };
    const html = renderToStaticMarkup(<WorkerDocumentsView workerId={1} />);
    expect(html).not.toContain("CURP");
    expect(html).not.toContain("Expediente documental");
  });

  test("a missing worker shows the exact error message", () => {
    nextWorker = { isLoading: false, worker: null, error: null };
    nextCatalog = { isLoading: false, documentCatalog: [], error: null };
    nextSemesters = { isLoading: false, semesters: [], error: null };
    nextAllDocuments = { isLoading: false, workerDocuments: [], error: null };
    nextSemesterDocuments = { isLoading: false, workerDocuments: [], error: null };
    const html = renderToStaticMarkup(<WorkerDocumentsView workerId={1} />);
    expect(html).toContain("El trabajador no existe.");
  });

  test("a query error shows the error message, not the missing-worker message", () => {
    nextWorker = { isLoading: false, worker: null, error: new Error("network failed") };
    const html = renderToStaticMarkup(<WorkerDocumentsView workerId={1} />);
    expect(html).toContain("network failed");
    expect(html).not.toContain("El trabajador no existe.");
  });
});
