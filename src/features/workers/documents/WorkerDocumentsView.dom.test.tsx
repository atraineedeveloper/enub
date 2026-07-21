import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireClick,
  fireSelectValue,
  flush,
  renderDom,
  type DomRender,
} from "../../../testUtils/renderDom";

// Real-DOM, end-to-end coverage for WorkerDocumentsView + real react-query:
// this is the ONLY level at which the actual root-cause fix
// (placeholderData: keepPreviousData in useWorkerDocumentsBySemester) is
// observable -- WorkerDocumentsDashboard's own DOM suite drives the
// dashboard directly via props and can prove resolveActiveCategoryId's
// contract, but it never exercises the real isLoading gate in
// WorkerDocumentsView that used to swap the whole subtree to <Spinner/>
// (and unmount the dashboard) on every semester change. Only network
// functions are mocked (apiWorkers/apiSemesters/apiWorkerDocuments); every
// hook and the real QueryClient run for real.
//
// IMPORTANT -- run with `bun test --isolate` alongside other files that
// import the same hook chain for real (see the identical note in
// WorkerDocumentsDashboard.dom.test.tsx for why).

let workerDocumentsBySemesterCalls: Array<{ workerId: number; semesterId: unknown }> = [];
let uploadCalls: unknown[] = [];
let replaceCalls: unknown[] = [];
let deleteCalls: unknown[] = [];

// Overridable per-test: defaults to resolving immediately with an empty
// array (matching every existing test's expectations below). The critical-
// interval tests replace this with a function that returns a controllable,
// manually-resolved promise for one specific semesterId, so the test can
// pause exactly inside the "new period requested, old data still on
// screen" window and assert on it before letting the fetch resolve.
let semesterDocumentsBehavior: (
  workerId: number,
  semesterId: unknown
) => Promise<unknown[]> = async () => [];

mock.module("../../../services/apiWorkers", () => ({
  getWorkerById: async (id: number) => ({
    id,
    name: "Ana Pérez",
    type_worker: "Docente",
  }),
}));

mock.module("../../../services/apiSemesters", () => ({
  getSemesters: async () => [
    { id: 1, semester: "25A", school_year: "2025-2026" },
    { id: 2, semester: "25B", school_year: "2025-2026" },
  ],
}));

mock.module("../../../services/apiWorkerDocuments", () => ({
  getWorkerDocumentCategoriesAndTypes: async () => [
    {
      id: 10,
      name: "Datos personales",
      scope: "permanent",
      sort_order: 10,
      document_types: [
        {
          id: 100,
          category_id: 10,
          name: "CURP",
          allows_multiple: false,
          is_active: true,
          sort_order: 10,
          description: null,
        },
      ],
    },
    {
      id: 30,
      name: "Tutoría",
      scope: "semester",
      sort_order: 30,
      document_types: [
        {
          id: 30,
          category_id: 30,
          name: "Plan de Trabajo",
          allows_multiple: false,
          is_active: true,
          sort_order: 5,
          description: null,
        },
      ],
    },
    {
      id: 40,
      name: "Asesoría",
      scope: "semester",
      sort_order: 40,
      document_types: [
        {
          id: 24,
          category_id: 40,
          name: "Control de asesorías",
          allows_multiple: false,
          is_active: true,
          sort_order: 10,
          description: "Bitácoras",
        },
      ],
    },
  ],
  getWorkerDocuments: async () => [],
  getWorkerDocumentsBySemester: async (workerId: number, semesterId: unknown) => {
    workerDocumentsBySemesterCalls.push({ workerId, semesterId });
    return semesterDocumentsBehavior(workerId, semesterId);
  },
  getWorkerDocumentReportData: async () => null,
  uploadWorkerDocument: async (vars: unknown) => {
    uploadCalls.push(vars);
    throw new Error("not exercised by this suite");
  },
  replaceWorkerDocument: async (vars: unknown) => {
    replaceCalls.push(vars);
    throw new Error("not exercised by this suite");
  },
  deleteWorkerDocument: async (id: unknown) => {
    deleteCalls.push(id);
    throw new Error("not exercised by this suite");
  },
  getWorkerDocumentSignedUrl: async () => {
    throw new Error("not exercised by this suite");
  },
}));

const { default: WorkerDocumentsView } = await import("./WorkerDocumentsView");

let queryClient: QueryClient;
let currentRender: DomRender | null = null;

beforeEach(() => {
  workerDocumentsBySemesterCalls = [];
  uploadCalls = [];
  replaceCalls = [];
  deleteCalls = [];
  semesterDocumentsBehavior = async () => [];
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(() => {
  currentRender?.unmount();
  currentRender = null;
});

function renderView() {
  currentRender = renderDom(
    <QueryClientProvider client={queryClient}>
      <WorkerDocumentsView workerId={1} />
    </QueryClientProvider>
  );
  return currentRender;
}

// WorkerDocumentsView's data dependency chain resolves in multiple ticks
// (worker/catalog/semesters/allDocuments queries settle, THEN an effect
// picks the first semester and enables the semester-scoped queries, THEN
// those settle) -- a single flush() (one macrotask) isn't always enough to
// drain it. Calling flush() repeatedly is the straightforward way to wait
// out a multi-stage async chain without hard-coding how many ticks it
// takes.
async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await flush();
  }
}

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: Math.floor(Math.random() * 100000),
    worker_id: 1,
    document_type_id: 24,
    semester_id: 1,
    file_name: "archivo.pdf",
    storage_path: "1/24/1/uuid-archivo.pdf",
    mime_type: "application/pdf",
    file_size: 100,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Carga inicial vs. refetch de periodo", () => {
  test("la carga inicial (sin datos previos de ningún periodo) muestra el spinner, no el expediente", () => {
    renderView();

    // Nothing has resolved yet -- the dashboard's own heading must not be
    // present, and no category tab either.
    expect(document.body.textContent).not.toContain("Expediente documental");
  });

  test("tras la carga inicial, el expediente se muestra y el spinner desaparece", async () => {
    renderView();
    await settle();

    expect(document.body.textContent).toContain("Expediente documental");
    expect(document.body.textContent).toContain("Ana Pérez");
  });

  test("cambiar de periodo (refetch con datos previos) no desmonta el dashboard -- el mismo nodo del DOM persiste", async () => {
    const { container } = renderView();
    await settle();

    const stableNode = container.querySelector("h1")?.closest("div");
    expect(stableNode).not.toBeNull();
    expect(stableNode!.isConnected).toBe(true);

    // The semester <select> is only present once a semester-scoped
    // category is active; "Datos personales" (permanent) is selected
    // first, so switch to Asesoría to reach it.
    const asesoriaTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === "Asesoría"
    ) as HTMLElement | undefined;
    expect(asesoriaTab).not.toBeUndefined();
    fireClick(asesoriaTab!);
    await settle();

    const semesterSelect = document.querySelector<HTMLSelectElement>("#semester")!;
    expect(semesterSelect).not.toBeNull();
    fireSelectValue(semesterSelect, "2");
    await settle();

    // The exact same DOM node from before the semester change is still
    // connected and identical by reference -- proves
    // WorkerDocumentsDashboard was never unmounted/remounted for this
    // refetch, unlike before placeholderData: keepPreviousData was added.
    const nodeAfter = container.querySelector("h1")?.closest("div");
    expect(nodeAfter).toBe(stableNode);
    expect(document.body.textContent).toContain("Expediente documental");
  });
});

describe("Conservar categoría al cambiar de periodo (extremo a extremo, DOM real)", () => {
  test("seleccionar Asesoría, cambiar de periodo, esperar el refetch -- Asesoría sigue seleccionada (tabs de escritorio)", async () => {
    renderView();
    await settle();

    const asesoriaTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === "Asesoría"
    ) as HTMLElement;
    fireClick(asesoriaTab);
    await settle();
    expect(asesoriaTab.getAttribute("aria-selected")).toBe("true");

    const semesterSelect = document.querySelector<HTMLSelectElement>("#semester")!;
    fireSelectValue(semesterSelect, "2");
    await settle();

    const asesoriaTabAfter = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === "Asesoría"
    ) as HTMLElement;
    expect(asesoriaTabAfter.getAttribute("aria-selected")).toBe("true");
    expect(document.body.textContent).toContain("Control de asesorías");
    expect(workerDocumentsBySemesterCalls.some((call) => call.semesterId === "2")).toBe(true);
  });

  test("seleccionar Tutoría, cambiar de periodo, esperar el refetch -- Tutoría sigue seleccionada", async () => {
    renderView();
    await settle();

    const tutoriaTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === "Tutoría"
    ) as HTMLElement;
    fireClick(tutoriaTab);
    await settle();
    expect(tutoriaTab.getAttribute("aria-selected")).toBe("true");

    const semesterSelect = document.querySelector<HTMLSelectElement>("#semester")!;
    fireSelectValue(semesterSelect, "2");
    await settle();

    const tutoriaTabAfter = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === "Tutoría"
    ) as HTMLElement;
    expect(tutoriaTabAfter.getAttribute("aria-selected")).toBe("true");
    expect(document.body.textContent).toContain("Plan de Trabajo");
  });

  test("lo mismo a través del <select> de categoría móvil (misma selectedCategoryId, otra rama de render)", async () => {
    renderView();
    await settle();

    const mobileSelect = document.querySelector<HTMLSelectElement>(
      "#document-category-select"
    )!;
    fireSelectValue(mobileSelect, "40");
    await settle();
    expect(mobileSelect.value).toBe("40");

    const semesterSelect = document.querySelector<HTMLSelectElement>("#semester")!;
    fireSelectValue(semesterSelect, "2");
    await settle();

    const mobileSelectAfter = document.querySelector<HTMLSelectElement>(
      "#document-category-select"
    )!;
    expect(mobileSelectAfter.value).toBe("40");
    expect(document.body.textContent).toContain("Control de asesorías");
  });
});

describe("Intervalo crítico: solo lectura mientras isPlaceholderData está activo", () => {
  test("cambiar de periodo con la respuesta de B pendiente: montado, categoría conservada, 'Actualizando periodo…', aria-busy, filas/reporte deshabilitados, drawer bloqueado, ninguna mutación -- hasta resolver B", async () => {
    // A has 1 document, B has 2 -- distinguishable via the row's own
    // "N archivo(s)" text (the row never shows a file NAME, only a count/
    // last-upload-date; file names only appear inside the drawer's
    // uploaded-file list, which this scenario never opens).
    let resolveSemesterB!: () => void;
    semesterDocumentsBehavior = async (_workerId, semesterId) => {
      if (semesterId === "1") {
        return [makeDoc({ id: 1, semester_id: 1, file_name: "asesoria-A.pdf" })];
      }
      if (semesterId === "2") {
        return new Promise((resolve) => {
          resolveSemesterB = () =>
            resolve([
              makeDoc({ id: 2, semester_id: 2, file_name: "asesoria-B-1.pdf" }),
              makeDoc({ id: 3, semester_id: 2, file_name: "asesoria-B-2.pdf" }),
            ]);
        });
      }
      return [];
    };

    const { container } = renderView();
    await settle();

    const asesoriaTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === "Asesoría"
    ) as HTMLElement;
    fireClick(asesoriaTab);
    await settle();
    expect(document.body.textContent).toContain("1 archivo ·");

    // PageContainer is the sole element carrying aria-busy -- selecting it
    // directly (rather than via a generic .closest("div")) lets the same
    // reference double as both "the stable mounted node" and "the busy
    // indicator" for the assertions below.
    const stableNode = container.querySelector("[aria-busy]");
    expect(stableNode).not.toBeNull();

    const semesterSelect = document.querySelector<HTMLSelectElement>("#semester")!;
    fireSelectValue(semesterSelect, "2");
    // Deliberately only 2 ticks -- enough for the query to start (calling
    // the mock, which captures resolveSemesterB) but resolveSemesterB is
    // never called here, so B's fetch stays pending throughout this block.
    await flush();
    await flush();

    // -- During the interval --
    expect(container.querySelector("[aria-busy]")).toBe(stableNode);

    const asesoriaTabDuring = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === "Asesoría"
    ) as HTMLElement;
    expect(asesoriaTabDuring.getAttribute("aria-selected")).toBe("true");

    expect(document.body.textContent).toContain("Actualizando periodo…");
    expect(stableNode!.getAttribute("aria-busy")).toBe("true");

    const rowButton = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Reemplazar archivo"
    ) as HTMLButtonElement | undefined;
    expect(rowButton).not.toBeUndefined();
    expect(rowButton!.disabled).toBe(true);

    // Clicking the (disabled) row does not open the drawer -- true
    // regardless of whether happy-dom itself suppresses a synthetic click
    // on a disabled button, since openRequirement also guards on
    // isUpdatingSemesterData directly (defense in depth).
    fireClick(rowButton!);
    await flush();
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    const downloadButton = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Descargar reporte")
    ) as HTMLButtonElement;
    expect(downloadButton.disabled).toBe(true);

    expect(uploadCalls).toHaveLength(0);
    expect(replaceCalls).toHaveLength(0);
    expect(deleteCalls).toHaveLength(0);

    // Still showing A's 1-document count as context, never B's.
    expect(document.body.textContent).toContain("1 archivo ·");
    expect(document.body.textContent).not.toContain("2 archivos ·");

    // -- Resolve B --
    resolveSemesterB();
    await settle();

    expect(document.body.textContent).not.toContain("Actualizando periodo…");
    expect(document.body.textContent).toContain("2 archivos ·");
    expect(document.body.textContent).not.toContain("1 archivo ·");

    const rowButtonAfter = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Reemplazar archivo"
    ) as HTMLButtonElement;
    expect(rowButtonAfter.disabled).toBe(false);

    const downloadButtonAfter = Array.from(document.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Descargar reporte")
    ) as HTMLButtonElement;
    expect(downloadButtonAfter.disabled).toBe(false);

    const asesoriaTabAfter = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === "Asesoría"
    ) as HTMLElement;
    expect(asesoriaTabAfter.getAttribute("aria-selected")).toBe("true");
    expect(stableNode!.getAttribute("aria-busy")).toBe("false");
  });

  test("un clic en una fila durante placeholderData nunca abre el drawer (prueba dedicada)", async () => {
    let resolveSemesterB!: () => void;
    semesterDocumentsBehavior = async (_workerId, semesterId) => {
      if (semesterId === "2") {
        return new Promise((resolve) => {
          resolveSemesterB = () => resolve([]);
        });
      }
      return [];
    };

    renderView();
    await settle();

    const asesoriaTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === "Asesoría"
    ) as HTMLElement;
    fireClick(asesoriaTab);
    await settle();

    const semesterSelect = document.querySelector<HTMLSelectElement>("#semester")!;
    fireSelectValue(semesterSelect, "2");
    await flush();
    await flush();

    const nameButton = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Control de asesorías"
    ) as HTMLButtonElement;
    const actionButton = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Subir archivo"
    ) as HTMLButtonElement;
    expect(nameButton.disabled).toBe(true);
    expect(actionButton.disabled).toBe(true);

    fireClick(nameButton);
    fireClick(actionButton);
    await flush();

    expect(document.querySelector('[role="dialog"]')).toBeNull();

    resolveSemesterB();
    await settle();
  });
});
