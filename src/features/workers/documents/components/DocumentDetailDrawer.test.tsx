import { describe, expect, test } from "bun:test";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Modal from "../../../../ui/Modal";
import { DocumentDetailDrawerView } from "./DocumentDetailDrawer";
import type { WorkerDocumentType } from "../useWorkerDocumentCatalog";
import type { WorkerDocument } from "../useWorkerDocuments";
import type { UploadQueueItem } from "../useUploadWorkerDocuments";

// Real-render coverage for the drawer's presentational half
// (DocumentDetailDrawerView), tested directly rather than through the
// default-exported DocumentDetailDrawer: the outer component's own
// createPortal(..., document.body) call evaluates `document.body` eagerly
// as a plain function argument -- unavoidable even if createPortal itself
// were mocked -- and this project's test environment has no jsdom/
// happy-dom (no `document` global at all), so anything that touches
// `document` (even just evaluating the expression, without executing
// any DOM API) cannot run here. DocumentDetailDrawerView is the
// deliberately-extracted, portal-free, hook-free presentational component
// that owns 100% of the actual markup/behavior branching (single/multi,
// active/inactive, replace warning, file ordering, footer) -- exactly
// what these tests need to prove, via plain props instead of hooks.
// Wrapped in a real <Modal> so UploadedFileList's own per-file
// "Eliminar" confirmation (Modal.Open/Modal.Window) renders normally.

function documentType(overrides: Partial<WorkerDocumentType> = {}): WorkerDocumentType {
  return {
    id: 1,
    category_id: 1,
    name: "Evidencias bimestrales",
    allows_multiple: true,
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
    semester_id: 1,
    file_name: "archivo.pdf",
    storage_path: "1/1/1/uuid-archivo.pdf",
    mime_type: "application/pdf",
    file_size: 100,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as WorkerDocument;
}

function renderDrawerView(
  overrides: Partial<Parameters<typeof DocumentDetailDrawerView>[0]> = {}
) {
  const type = overrides.documentType ?? documentType();
  const documents = overrides.documents ?? [];

  return renderToStaticMarkup(
    <Modal>
      <DocumentDetailDrawerView
        panelRef={createRef<HTMLDivElement>()}
        titleId={`document-detail-drawer-title-${type.id}`}
        documentType={type}
        documents={documents}
        allowsMultiple={type.allows_multiple}
        isBusy={false}
        isDeleting={false}
        onDeleteDocument={() => {}}
        onView={() => {}}
        onDownload={() => {}}
        onRequestClose={() => {}}
        singleFileInputVersion={0}
        existingQueueFiles={[]}
        onFilesAdded={() => {}}
        multiItems={[]}
        onRemoveMultiItem={() => {}}
        onRetryMultiItem={() => {}}
        singleFile={null}
        singleFileError={null}
        isSingleWorking={false}
        onRemoveSingleFile={() => {}}
        onRetrySingleFile={() => {}}
        pendingCount={0}
        confirmLabel="Subir archivo"
        pendingLabel="Subiendo..."
        onConfirm={() => {}}
        onCancel={() => {}}
        {...overrides}
      />
    </Modal>
  );
}

describe("DocumentDetailDrawer -- accesibilidad", () => {
  test("role=dialog, aria-modal=true, y aria-labelledby apuntando al título", () => {
    const html = renderDrawerView();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/aria-labelledby="document-detail-drawer-title-1"/);
    expect(html).toMatch(/id="document-detail-drawer-title-1"[^>]*>Evidencias bimestrales/);
  });

  test("el botón de cerrar tiene aria-label", () => {
    const html = renderDrawerView();
    expect(html).toContain('aria-label="Cerrar"');
  });
});

describe("DocumentDetailDrawer -- comportamiento single/multiple", () => {
  test("multi-file: dropzone con input multiple, sin advertencia de reemplazo", () => {
    const html = renderDrawerView({
      documentType: documentType({ allows_multiple: true }),
      allowsMultiple: true,
    });
    expect(html).toMatch(/<input[^>]*type="file"[^>]*multiple/);
    expect(html).not.toContain("reemplazará el documento actual");
  });

  test("single-file sin documento: dropzone sin multiple, sin advertencia", () => {
    const html = renderDrawerView({
      documentType: documentType({ allows_multiple: false }),
      allowsMultiple: false,
      documents: [],
    });
    expect(html).not.toMatch(/<input[^>]*type="file"[^>]*multiple/);
    expect(html).not.toContain("reemplazará el documento actual");
  });

  test("single-file con documento existente: advertencia explícita de reemplazo", () => {
    const html = renderDrawerView({
      documentType: documentType({ allows_multiple: false }),
      allowsMultiple: false,
      documents: [makeDocument()],
    });
    expect(html).toContain("reemplazará el documento actual");
  });

  test("la descripción natural del tipo vive en el drawer (no en la fila)", () => {
    const multiHtml = renderDrawerView({
      documentType: documentType({ allows_multiple: true }),
      allowsMultiple: true,
    });
    expect(multiHtml).toContain("Puedes adjuntar varios archivos.");

    const singleHtml = renderDrawerView({
      documentType: documentType({ allows_multiple: false }),
      allowsMultiple: false,
    });
    expect(singleHtml).toContain("Se admite un archivo.");
  });
});

describe("DocumentDetailDrawer -- tipo inactivo", () => {
  test("sin controles de carga, con la nota de inactividad", () => {
    const html = renderDrawerView({
      documentType: documentType({ is_active: false }),
      documents: [makeDocument()],
    });

    expect(html).not.toMatch(/type="file"/);
    expect(html).not.toContain("Cancelar");
    expect(html).toContain("Este requisito ya no acepta nuevas cargas");
  });
});

describe("DocumentDetailDrawer -- lista de archivos", () => {
  test("recibe y muestra los documentos en el orden en que se le entregan (el orden 'más recientes primero' lo aplica el componente que llama a sortWorkerDocumentsByRecency antes de pasarlos aquí)", () => {
    const html = renderDrawerView({
      documents: [
        makeDocument({ id: 2, file_name: "nuevo.pdf", created_at: "2026-03-01T00:00:00.000Z" }),
        makeDocument({ id: 3, file_name: "medio.pdf", created_at: "2026-02-01T00:00:00.000Z" }),
        makeDocument({ id: 1, file_name: "viejo.pdf", created_at: "2026-01-01T00:00:00.000Z" }),
      ],
    });

    expect(html.indexOf("nuevo.pdf")).toBeLessThan(html.indexOf("medio.pdf"));
    expect(html.indexOf("medio.pdf")).toBeLessThan(html.indexOf("viejo.pdf"));
  });

  test("contador en el encabezado", () => {
    const html = renderDrawerView({
      documents: [makeDocument({ id: 1 }), makeDocument({ id: 2 })],
    });
    expect(html).toContain("2 archivos cargados");
  });

  test("acciones Ver, Descargar y Eliminar siguen presentes por archivo", () => {
    const html = renderDrawerView({ documents: [makeDocument({ file_name: "evidencia.pdf" })] });
    expect(html).toContain("Ver evidencia.pdf");
    expect(html).toContain("Descargar evidencia.pdf");
    expect(html).toContain("Eliminar evidencia.pdf");
  });
});

describe("DocumentDetailDrawer -- error parcial mantiene el panel con la fila visible", () => {
  test("un archivo con estado 'error' en la cola se muestra con su mensaje", () => {
    const multiItems: UploadQueueItem[] = [
      {
        id: "q1",
        file: new File(["x"], "fallo.pdf", { type: "application/pdf" }),
        status: "error",
        errorMessage: "El archivo no pudo subirse",
      },
    ];
    const html = renderDrawerView({
      documentType: documentType({ allows_multiple: true }),
      allowsMultiple: true,
      multiItems,
    });

    expect(html).toContain("fallo.pdf");
    expect(html).toContain("El archivo no pudo subirse");
  });
});
