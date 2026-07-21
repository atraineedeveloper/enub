import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireClick,
  fireInputValue,
  fireKeyDown,
  fireSelectValue,
  flush,
  renderDom,
  selectFiles,
  type DomRender,
} from "../../../testUtils/renderDom";
import type { WorkerDocumentCategory, WorkerDocumentType } from "./useWorkerDocumentCatalog";
import type { WorkerDocument } from "./useWorkerDocuments";
import type { Semester } from "../../semesters/useSemesters";
import type { Worker } from "../useWorkers";

// Real-DOM interaction coverage for the dashboard/drawer architecture.
// Only the network boundary (apiWorkerDocuments.ts, i.e. Supabase) is
// mocked -- every hook (useUploadWorkerDocument, useReplaceWorkerDocument,
// useDeleteWorkerDocument, useUploadWorkerDocuments), the queue lifecycle,
// the close-guard, and every component in between run for real against a
// real QueryClient and real DOM events. This is deliberate: the whole
// point of this suite is to prove the WIRING between those real pieces,
// which a hook-mocking test (like the earlier static-render suites) can't
// do by construction.
//
// IMPORTANT -- run this file (or any suite that includes it alongside other
// files importing the same hooks, e.g. `bun test src/features/workers/documents src/ui`)
// with `bun test --isolate`. useUploadWorkerDocument.ts/useReplaceWorkerDocument.ts/
// useUploadWorkerDocuments.ts each snapshot `uploadWorkerDocument`/
// `replaceWorkerDocument` into a module-top-level const once, the first time
// they're evaluated. Without --isolate, bun test shares one module registry
// across every file in the run: if another file (e.g.
// useUploadWorkerDocuments.test.ts) evaluates that chain for real before
// this file's mock.module call below runs, the snapshot is permanently
// bound to the real function and this file's mock never takes effect, even
// though mock.module itself succeeds. --isolate gives each test file a
// fresh module registry, so this file's own mock.module call always wins
// for its own import of ./WorkerDocumentsDashboard. Running this file alone
// is unaffected either way.

let uploadCalls: Array<{ workerId: number; documentTypeId: number; semesterId: unknown; file: File }> = [];
let replaceCalls: Array<{ workerId: number; documentTypeId: number; semesterId: unknown; file: File }> = [];
let deleteCalls: number[] = [];
let uploadBehavior: (file: File) => Promise<Record<string, unknown>> = async (file) => ({
  id: Math.floor(Math.random() * 100000),
  worker_id: 1,
  document_type_id: 0,
  semester_id: null,
  file_name: file.name,
  storage_path: `mock/${file.name}`,
  mime_type: "application/pdf",
  file_size: file.size,
  created_at: new Date().toISOString(),
});
let replaceBehavior: (file: File) => Promise<Record<string, unknown>> = async (file) => ({
  id: Math.floor(Math.random() * 100000),
  worker_id: 1,
  document_type_id: 0,
  semester_id: null,
  file_name: file.name,
  storage_path: `mock/${file.name}`,
  mime_type: "application/pdf",
  file_size: file.size,
  created_at: new Date().toISOString(),
  storageCleanupFailed: false,
});

mock.module("../../../services/apiWorkerDocuments", () => ({
  uploadWorkerDocument: async (vars: { workerId: number; documentTypeId: number; semesterId: unknown; file: File }) => {
    uploadCalls.push(vars);
    return uploadBehavior(vars.file);
  },
  replaceWorkerDocument: async (vars: { workerId: number; documentTypeId: number; semesterId: unknown; file: File }) => {
    replaceCalls.push(vars);
    return replaceBehavior(vars.file);
  },
  deleteWorkerDocument: async (documentId: number) => {
    deleteCalls.push(documentId);
    return { documentId, workerId: 1, storageCleanupFailed: false };
  },
}));

const { default: WorkerDocumentsDashboard } = await import("./WorkerDocumentsDashboard");

function makeFile(name: string, size = 100): File {
  return new File(["x".repeat(size)], name, { type: "application/pdf" });
}

const worker: Pick<Worker, "name" | "type_worker"> = {
  name: "Ana Pérez",
  type_worker: "Docente",
};

const semesters: Semester[] = [
  { id: 1, semester: "25A", school_year: "2025-2026" } as Semester,
  { id: 2, semester: "25B", school_year: "2025-2026" } as Semester,
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

function makeDocument(overrides: Partial<WorkerDocument> = {}): WorkerDocument {
  return {
    id: 1,
    worker_id: 1,
    document_type_id: 1,
    semester_id: null,
    file_name: "curp-actual.pdf",
    storage_path: "1/100/permanent/uuid-curp-actual.pdf",
    mime_type: "application/pdf",
    file_size: 100,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as WorkerDocument;
}

// Fixture catalog shared by most tests: a permanent category with a
// single-file type that already has a document (CURP -- exercises the
// replace path) and a multi-file type with none (Evidencias -- exercises
// the batch-upload path); a second, semester-scoped category (Docencia)
// with its own single-file type, for the category/semester-switch tests.
const curpType = type({ id: 100, category_id: 10, name: "CURP", allows_multiple: false });
const evidenciasType = type({ id: 101, category_id: 10, name: "Evidencias", allows_multiple: true });
const planeacionType = type({ id: 200, category_id: 20, name: "Planeación", allows_multiple: false });

function buildCatalog(): WorkerDocumentCategory[] {
  return [
    {
      id: 10,
      name: "Datos personales",
      scope: "permanent",
      sort_order: 10,
      created_at: "2026-01-01T00:00:00.000Z",
      document_types: [curpType, evidenciasType],
    } as WorkerDocumentCategory,
    {
      id: 20,
      name: "Docencia",
      scope: "semester",
      sort_order: 20,
      created_at: "2026-01-01T00:00:00.000Z",
      document_types: [planeacionType],
    } as WorkerDocumentCategory,
  ];
}

function buildDocumentsByType(): Map<number, WorkerDocument[]> {
  return new Map([[100, [makeDocument({ id: 1, document_type_id: 100 })]]]);
}

let queryClient: QueryClient;
let invalidateCallCount = 0;
let currentRender: DomRender | null = null;

beforeEach(() => {
  uploadCalls = [];
  replaceCalls = [];
  deleteCalls = [];
  invalidateCallCount = 0;
  uploadBehavior = async (file) => ({
    id: Math.floor(Math.random() * 100000),
    worker_id: 1,
    document_type_id: 0,
    semester_id: null,
    file_name: file.name,
    storage_path: `mock/${file.name}`,
    mime_type: "application/pdf",
    file_size: file.size,
    created_at: new Date().toISOString(),
  });
  replaceBehavior = async (file) => ({
    id: Math.floor(Math.random() * 100000),
    worker_id: 1,
    document_type_id: 0,
    semester_id: null,
    file_name: file.name,
    storage_path: `mock/${file.name}`,
    mime_type: "application/pdf",
    file_size: file.size,
    created_at: new Date().toISOString(),
    storageCleanupFailed: false,
  });

  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);
  queryClient.invalidateQueries = ((...args: Parameters<typeof originalInvalidate>) => {
    invalidateCallCount += 1;
    return originalInvalidate(...args);
  }) as typeof queryClient.invalidateQueries;
});

afterEach(() => {
  currentRender?.unmount();
  currentRender = null;
});

function renderDashboard(overrides: Record<string, unknown> = {}) {
  currentRender = renderDom(
    <QueryClientProvider client={queryClient}>
      <WorkerDocumentsDashboard
        worker={worker}
        workerId={1}
        documentCatalog={buildCatalog()}
        documentsByType={buildDocumentsByType()}
        semesters={semesters}
        selectedSemesterId="1"
        onSemesterChange={() => {}}
        isUpdatingSemesterData={false}
        isLoadingReport={false}
        onDownloadReport={() => {}}
        onView={() => {}}
        onDownload={() => {}}
        {...overrides}
      />
    </QueryClientProvider>
  );
  return currentRender;
}

function getRowButton(name: string): HTMLElement {
  const buttons = Array.from(document.querySelectorAll("button"));
  const button = buttons.find((el) => el.closest("li")?.textContent?.includes(name) && /Subir|Agregar|Reemplazar|Ver archivos/.test(el.textContent ?? ""));
  if (!button) throw new Error(`No row action button found for "${name}"`);
  return button;
}

function getDialog(): HTMLElement {
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) throw new Error("No dialog is currently open");
  return dialog;
}

function queryDialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

describe("Abrir y cerrar el drawer", () => {
  test("hacer click en la acción de una fila abre el drawer del requisito correcto", () => {
    renderDashboard();
    fireClick(getRowButton("Evidencias"));

    const dialog = getDialog();
    expect(dialog.textContent).toContain("Evidencias");
  });

  test("el botón de cerrar (X) cierra el drawer cuando no hay selección pendiente", () => {
    renderDashboard();
    fireClick(getRowButton("Evidencias"));
    const dialog = getDialog();

    const closeButton = dialog.querySelector<HTMLElement>('[aria-label="Cerrar"]')!;
    fireClick(closeButton);

    expect(queryDialog()).toBeNull();
  });
});

describe("Escape", () => {
  test("Escape cierra el drawer cuando no hay selección pendiente", () => {
    renderDashboard();
    fireClick(getRowButton("Evidencias"));
    expect(queryDialog()).not.toBeNull();

    fireKeyDown(document, "Escape");

    expect(queryDialog()).toBeNull();
  });
});

describe("Overlay", () => {
  test("un click en el overlay cierra el drawer cuando no hay selección pendiente", () => {
    renderDashboard();
    fireClick(getRowButton("Evidencias"));
    // The overlay is the sibling rendered immediately before the dialog
    // itself -- located via that sibling structure instead of a brittle
    // nth-child guess.
    const dialog = getDialog();
    const overlayCandidate = dialog.previousElementSibling as HTMLElement | null;
    expect(overlayCandidate).not.toBeNull();

    fireClick(overlayCandidate!);

    expect(queryDialog()).toBeNull();
  });
});

describe("Focus trap y foco inicial", () => {
  test("al abrir el drawer, el foco inicial queda dentro de él", () => {
    renderDashboard();
    fireClick(getRowButton("Evidencias"));
    const dialog = getDialog();

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  test("Tab desde el último elemento enfocable del drawer vuelve al primero", () => {
    renderDashboard();
    fireClick(getRowButton("Evidencias"));
    const dialog = getDialog();
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    fireKeyDown(document, "Tab");

    expect(document.activeElement).toBe(first);
  });
});

describe("Restauración de foco", () => {
  test("cerrar el drawer devuelve el foco al control de la fila que lo abrió", () => {
    renderDashboard();
    const rowButton = getRowButton("Evidencias");
    rowButton.focus();
    fireClick(rowButton);

    fireKeyDown(document, "Escape");

    expect(document.activeElement).toBe(rowButton);
  });
});

describe("ConfirmDelete dentro del drawer: coordinación con Modal.Window", () => {
  test("abrir 'Eliminar' desde un archivo cargado enfoca el modal superior; Escape lo cierra sin cerrar el drawer; el foco vuelve al botón que lo abrió", () => {
    renderDashboard();
    fireClick(getRowButton("CURP"));
    const drawerDialog = getDialog();
    expect(drawerDialog.textContent).toContain("curp-actual.pdf");

    const deleteButton = drawerDialog.querySelector<HTMLElement>(
      '[aria-label="Eliminar curp-actual.pdf"]'
    )!;
    // A real browser click also focuses the clicked button -- a synthetic
    // dispatchEvent click doesn't reproduce that on its own (same reason
    // ui/Modal.test.tsx's openDialog() focuses its trigger explicitly).
    deleteButton.focus();
    fireClick(deleteButton);

    // Two role="dialog" elements now exist: the drawer itself, and the
    // ConfirmDelete modal opened on top of it via the SAME Modal provider
    // (DocumentDetailDrawer and UploadedFileRow's Modal.Open/Modal.Window
    // share one <Modal> context provided by WorkerDocumentsDashboard --
    // portals don't break React context).
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));
    expect(dialogs).toHaveLength(2);
    const confirmDialog = dialogs.find((el) => el !== drawerDialog)!;
    expect(confirmDialog).not.toBeUndefined();
    expect(confirmDialog.textContent).toContain("Eliminar curp-actual.pdf");

    // Focus moved into the top (ConfirmDelete) modal, not left on the
    // trigger and not on the drawer behind it.
    expect(confirmDialog.contains(document.activeElement)).toBe(true);

    fireKeyDown(document, "Escape");

    // ConfirmDelete closed; the drawer is still open -- it must NOT have
    // also handled this same Escape (DocumentDetailDrawer defers to
    // Modal.Window via useModal().openName whenever a Modal window is open
    // on top of it, see components/DocumentDetailDrawer.tsx).
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(queryDialog()).not.toBeNull();
    expect(document.body.textContent).not.toContain("¿Estas seguro");

    // Focus returns to the control that opened ConfirmDelete, not lost to
    // <body> or left on some other element.
    expect(document.activeElement).toBe(deleteButton);
  });
});

describe("Scroll lock y cleanup", () => {
  test("abrir el drawer bloquea el scroll del body; cerrarlo lo restaura", () => {
    const previousOverflow = document.body.style.overflow;
    renderDashboard();
    fireClick(getRowButton("Evidencias"));

    expect(document.body.style.overflow).toBe("hidden");

    fireKeyDown(document, "Escape");

    expect(document.body.style.overflow).toBe(previousOverflow);
  });
});

describe("Selección pendiente pide confirmación", () => {
  test("intentar cerrar con un archivo en la cola abre la confirmación de descarte en vez de cerrar", () => {
    renderDashboard();
    fireClick(getRowButton("Evidencias"));
    const dialog = getDialog();

    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    selectFiles(input, [makeFile("nuevo.pdf")]);

    const closeButton = dialog.querySelector<HTMLElement>('[aria-label="Cerrar"]')!;
    fireClick(closeButton);

    // The requirement drawer is still open (never actually closed)...
    expect(queryDialog()).not.toBeNull();
    // ...and a second dialog -- the discard confirmation -- is now showing.
    expect(document.body.textContent).toContain("Archivos sin subir");
    expect(document.body.textContent).toContain("Salir sin subir");
  });
});

describe("Subida activa bloquea el cierre", () => {
  test("mientras una subida está en curso, X/Escape no cierran el drawer ni abren la confirmación", async () => {
    let resolveUpload!: () => void;
    uploadBehavior = (file) =>
      new Promise((resolve) => {
        resolveUpload = () =>
          resolve({
            id: 1,
            worker_id: 1,
            document_type_id: 101,
            semester_id: null,
            file_name: file.name,
            storage_path: `mock/${file.name}`,
            mime_type: "application/pdf",
            file_size: file.size,
            created_at: new Date().toISOString(),
          });
      });

    renderDashboard();
    fireClick(getRowButton("Evidencias"));
    const dialog = getDialog();
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    selectFiles(input, [makeFile("lento.pdf")]);

    const uploadButton = Array.from(dialog.querySelectorAll("button")).find((btn) =>
      /^Subir/.test(btn.textContent ?? "")
    )!;
    fireClick(uploadButton);

    // The upload's promise has not resolved yet -- isBusy is true.
    const closeButton = dialog.querySelector<HTMLElement>('[aria-label="Cerrar"]')!;
    fireClick(closeButton);

    expect(queryDialog()).not.toBeNull();
    expect(document.body.textContent).not.toContain("Archivos sin subir");

    fireKeyDown(document, "Escape");
    expect(queryDialog()).not.toBeNull();

    // Let the upload settle so it doesn't leak into the next test.
    resolveUpload();
    await flush();
  });
});

describe("Confirmar descarte ejecuta la transición diferida", () => {
  test("confirmar 'Salir sin subir' cierra el drawer que se había intentado cerrar", () => {
    renderDashboard();
    fireClick(getRowButton("Evidencias"));
    const dialog = getDialog();
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    selectFiles(input, [makeFile("nuevo.pdf")]);

    fireClick(dialog.querySelector<HTMLElement>('[aria-label="Cerrar"]')!);
    expect(document.body.textContent).toContain("Salir sin subir");

    const discardButton = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Salir sin subir"
    )!;
    fireClick(discardButton);

    expect(queryDialog()).toBeNull();
  });

  test("cancelar la confirmación deja el drawer abierto con la selección intacta", () => {
    renderDashboard();
    fireClick(getRowButton("Evidencias"));
    const dialog = getDialog();
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    selectFiles(input, [makeFile("nuevo.pdf")]);

    fireClick(dialog.querySelector<HTMLElement>('[aria-label="Cerrar"]')!);

    // Both the drawer's own footer AND the discard-confirmation dialog
    // have their own "Cancelar" button -- the discard dialog is the one
    // whose dialog also contains "Salir sin subir" (the drawer's footer
    // does not), so it's picked out from among every dialog by that,
    // never by document order.
    const discardDialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
      (el) => el.textContent?.includes("Salir sin subir")
    )!;
    const cancelButton = Array.from(discardDialog.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Cancelar"
    )!;
    fireClick(cancelButton);

    expect(queryDialog()).not.toBeNull();
    expect(document.body.textContent).toContain("nuevo.pdf");
  });
});

describe("Varias solicitudes de transición no ejecutan una intención obsoleta", () => {
  test("confirmar tras dos solicitudes distintas ejecuta solo la más reciente", () => {
    renderDashboard();

    // First intent: try to close the Evidencias drawer.
    fireClick(getRowButton("Evidencias"));
    const firstDialog = getDialog();
    const input = firstDialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    selectFiles(input, [makeFile("archivo.pdf")]);
    fireClick(firstDialog.querySelector<HTMLElement>('[aria-label="Cerrar"]')!);
    expect(document.body.textContent).toContain("Salir sin subir");

    // Second, different intent, issued before confirming the first: open
    // a different requirement's row instead. This overwrites the stashed
    // transition with a fresh one.
    fireClick(getRowButton("CURP"));

    const discardButton = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Salir sin subir"
    )!;
    fireClick(discardButton);

    // The executed transition is the SECOND (most recent) one -- the
    // drawer now open shows CURP, never having closed outright (which is
    // what the FIRST, now-obsolete intent would have done).
    const dialog = getDialog();
    expect(dialog.textContent).toContain("CURP");
  });
});

describe("Cambio de categoría", () => {
  test("cambiar de categoría muestra los requisitos de la nueva categoría y limpia la búsqueda", () => {
    renderDashboard();

    const searchInput = document.querySelector<HTMLInputElement>('input[type="search"]')!;
    fireInputValue(searchInput, "Evid");

    const docenciaTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === "Docencia"
    )!;
    fireClick(docenciaTab as HTMLElement);

    expect(document.body.textContent).toContain("Planeación");
    expect(document.body.textContent).not.toContain("Evidencias");

    const searchInputAfter = document.querySelector<HTMLInputElement>('input[type="search"]')!;
    expect(searchInputAfter.value).toBe("");
  });
});

describe("Cambio de semestre", () => {
  test("cambiar el periodo académico invoca onSemesterChange con el nuevo valor", () => {
    const received: { value: string | null } = { value: null };
    renderDashboard({
      onSemesterChange: (value: string) => {
        received.value = value;
      },
    });

    const docenciaTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === "Docencia"
    )!;
    fireClick(docenciaTab as HTMLElement);

    const select = document.querySelector<HTMLSelectElement>("#semester")!;
    fireSelectValue(select, "2");

    expect(received.value).toBe("2");
  });

  test("con una selección pendiente en el drawer, cambiar de periodo pide confirmación en vez de cambiar de inmediato (mismo funnel requestDrawerTransition)", () => {
    const received: { value: string | null } = { value: null };
    renderDashboard({
      onSemesterChange: (value: string) => {
        received.value = value;
      },
    });

    const docenciaTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === "Docencia"
    )!;
    fireClick(docenciaTab as HTMLElement);

    fireClick(getRowButton("Planeación"));
    const dialog = getDialog();
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    selectFiles(input, [makeFile("planeacion.pdf")]);

    const select = document.querySelector<HTMLSelectElement>("#semester")!;
    fireSelectValue(select, "2");

    // The semester never actually changed yet -- the discard confirmation
    // is showing instead, exactly as it does for X/Escape/overlay/category
    // change (decideDrawerTransition, documentRequirementSummary.ts).
    expect(received.value).toBeNull();
    expect(document.body.textContent).toContain("Archivos sin subir");

    const discardButton = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Salir sin subir"
    )!;
    fireClick(discardButton);

    expect(received.value).toBe("2");
  });
});

describe("El filtro de estado persiste al cambiar de periodo", () => {
  test("cambiar de periodo no reinicia el filtro 'Con archivos' (solo la búsqueda se limpia al cambiar de categoría, nunca el filtro por semestre)", () => {
    renderDashboard();

    const docenciaTab = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === "Docencia"
    )!;
    fireClick(docenciaTab as HTMLElement);

    const withFilesChip = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Con archivos"
    )!;
    fireClick(withFilesChip);
    expect(withFilesChip.getAttribute("aria-pressed")).toBe("true");

    const select = document.querySelector<HTMLSelectElement>("#semester")!;
    fireSelectValue(select, "2");

    const withFilesChipAfter = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Con archivos"
    )!;
    expect(withFilesChipAfter.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("multi-file nunca llama replaceWorkerDocument", () => {
  test("subir 2 archivos en un tipo multi-file usa solo uploadWorkerDocument", async () => {
    renderDashboard();
    fireClick(getRowButton("Evidencias"));
    const dialog = getDialog();
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    selectFiles(input, [makeFile("a.pdf"), makeFile("b.pdf")]);

    const uploadButton = Array.from(dialog.querySelectorAll("button")).find((btn) =>
      /^Subir 2 archivos/.test(btn.textContent ?? "")
    )!;
    await flush();
    fireClick(uploadButton);
    await flush();

    expect(uploadCalls).toHaveLength(2);
    expect(replaceCalls).toHaveLength(0);
  });
});

describe("single-file con archivo sí usa replaceWorkerDocument", () => {
  test("reemplazar CURP (que ya tiene un documento) llama a replaceWorkerDocument, nunca a uploadWorkerDocument", async () => {
    renderDashboard();
    fireClick(getRowButton("CURP"));
    const dialog = getDialog();
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    selectFiles(input, [makeFile("curp-nuevo.pdf")]);

    const replaceButton = Array.from(dialog.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Reemplazar archivo"
    )!;
    fireClick(replaceButton);
    await flush();

    expect(replaceCalls).toHaveLength(1);
    expect(replaceCalls[0]?.file.name).toBe("curp-nuevo.pdf");
    expect(uploadCalls).toHaveLength(0);
  });
});

describe("Invalidación exactamente una vez por lote", () => {
  // invalidateWorkerDocumentQueries (workerDocumentKeys.ts) legitimately
  // calls queryClient.invalidateQueries twice per run -- once for the
  // catalog key, once for the worker key -- so the raw call count isn't
  // "1"; what "exactamente una vez por lote" means is that this fires once
  // PER BATCH, never once per file. That's what this test actually proves:
  // a 1-file batch and a 2-file batch produce the exact same invalidation
  // call count, i.e. it doesn't scale with how many files were in it.
  test("un lote de 2 archivos exitosos invalida las queries lo mismo que un lote de 1 archivo (no escala por archivo)", async () => {
    renderDashboard();
    fireClick(getRowButton("Evidencias"));
    const dialog = getDialog();
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    selectFiles(input, [makeFile("solo.pdf")]);

    const singleUploadButton = Array.from(dialog.querySelectorAll("button")).find((btn) =>
      /^Subir 1 archivo/.test(btn.textContent ?? "")
    )!;
    fireClick(singleUploadButton);
    await flush();

    expect(uploadCalls).toHaveLength(1);
    const invalidateCallsForOneFile = invalidateCallCount;
    expect(invalidateCallsForOneFile).toBeGreaterThan(0);

    invalidateCallCount = 0;
    uploadCalls = [];
    selectFiles(input, [makeFile("a.pdf"), makeFile("b.pdf")]);
    const multiUploadButton = Array.from(dialog.querySelectorAll("button")).find((btn) =>
      /^Subir 2 archivos/.test(btn.textContent ?? "")
    )!;
    fireClick(multiUploadButton);
    await flush();

    expect(uploadCalls).toHaveLength(2);
    expect(invalidateCallCount).toBe(invalidateCallsForOneFile);
  });
});

describe("Regresión: el guard de cierre no debe volver a contar completado (discardableCount)", () => {
  test("éxito total: tras una subida completamente exitosa, cerrar el drawer es inmediato y nunca abre 'Archivos sin subir'", async () => {
    renderDashboard();
    fireClick(getRowButton("Evidencias"));
    const dialog = getDialog();
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    selectFiles(input, [makeFile("uno.pdf"), makeFile("dos.pdf")]);

    const uploadButton = Array.from(dialog.querySelectorAll("button")).find((btn) =>
      /^Subir 2 archivos/.test(btn.textContent ?? "")
    )!;
    fireClick(uploadButton);
    await flush();

    expect(uploadCalls).toHaveLength(2);

    // The observable contract this guards: after a 100%-successful batch,
    // closing is immediate, never gated behind "Archivos sin subir". This
    // is what actually broke when the guard was `hasPendingSelection =
    // multi.items.length > 0` (counting "completado" items too). Verified
    // directly (temporarily reverting the fix locally, not committed) that
    // this assertion alone doesn't distinguish EVERY possible way that
    // regression could resurface: DocumentDetailDrawer's own
    // getDiscardableItems() call already excludes "completado" regardless
    // of whether the post-batch sweep runs, and the sweep
    // (removeCompletedItems, useUploadWorkerDocuments.ts) already empties
    // the queue by settle time regardless of which formula reads it --
    // each mechanism alone is enough to keep this exact scenario passing,
    // by design (defense in depth). Only reverting BOTH together
    // reproduces the user-visible bug; getDiscardableItems' own exclusion
    // of "completado" is unit-tested in isolation in
    // useUploadWorkerDocuments.test.ts. This test's job is the end-to-end
    // contract: whichever mechanism is responsible, a fully successful
    // batch must never block or gate closing.
    const closeButton = dialog.querySelector<HTMLElement>('[aria-label="Cerrar"]')!;
    fireClick(closeButton);

    expect(queryDialog()).toBeNull();
    expect(document.body.textContent).not.toContain("Archivos sin subir");
  });

  test("éxito parcial: los completados se retiran de la cola; solo los fallidos activan y cuentan en la confirmación de descarte", async () => {
    uploadBehavior = async (file) => {
      if (file.name === "falla.pdf") {
        throw new Error("Fallo simulado");
      }
      return {
        id: Math.floor(Math.random() * 100000),
        worker_id: 1,
        document_type_id: 101,
        semester_id: null,
        file_name: file.name,
        storage_path: `mock/${file.name}`,
        mime_type: "application/pdf",
        file_size: file.size,
        created_at: new Date().toISOString(),
      };
    };

    renderDashboard();
    fireClick(getRowButton("Evidencias"));
    const dialog = getDialog();
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
    selectFiles(input, [makeFile("exito.pdf"), makeFile("falla.pdf")]);

    const uploadButton = Array.from(dialog.querySelectorAll("button")).find((btn) =>
      /^Subir 2 archivos/.test(btn.textContent ?? "")
    )!;
    fireClick(uploadButton);
    await flush();

    expect(uploadCalls).toHaveLength(2);
    // The succeeded file was swept from the local queue immediately after
    // the batch settled (removeCompletedItems) -- it never appears again
    // anywhere in this fixture (documentsByType is static test input here,
    // not a live refetch), while the failed file stays, still visible and
    // retryable.
    expect(document.body.textContent).not.toContain("exito.pdf");
    expect(document.body.textContent).toContain("falla.pdf");

    const closeButton = dialog.querySelector<HTMLElement>('[aria-label="Cerrar"]')!;
    fireClick(closeButton);

    expect(document.body.textContent).toContain("Archivos sin subir");
    // Exactly the 1 failed file, never the succeeded one -- proves the
    // counter is discardableCount (preparado + error), never items.length.
    expect(document.body.textContent).toContain("Tienes 1 archivo sin subir");
  });
});
