import { DocumentDetailDrawerView } from "./DocumentDetailDrawerView";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModal } from "../../../../ui/useModal";
import { useUploadWorkerDocument } from "../useUploadWorkerDocument";
import { useReplaceWorkerDocument } from "../useReplaceWorkerDocument";
import { useDeleteWorkerDocument } from "../useDeleteWorkerDocument";
import {
  getDiscardableItems,
  useUploadWorkerDocuments,
} from "../useUploadWorkerDocuments";
import {
  getDrawerCloseGuard,
  sortWorkerDocumentsByRecency,
  type DrawerCloseGuard,
} from "../documentRequirementSummary";
import type { WorkerDocumentType } from "../useWorkerDocumentCatalog";
import type { WorkerDocument } from "../useWorkerDocuments";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DocumentDetailDrawerProps {
  documentType: WorkerDocumentType;
  documents: WorkerDocument[];
  workerId: number;
  semesterId: number | null;
  onView: (storagePath: string) => void;
  onDownload: (document: WorkerDocument) => void;
  onGuardChange: (guard: DrawerCloseGuard, discardableCount: number) => void;
  onRequestClose: () => void;
}

// role="dialog" + aria-modal + aria-labelledby, initial focus, a focus
// trap, restoring focus to whatever opened it, Escape-to-close, and a body
// scroll lock -- all self-contained here since this is the only consumer
// of this exact pattern in the codebase today (the existing <Modal> uses a
// lighter outside-click-only pattern, now also Escape/focus-aware, see
// ui/Modal.tsx). `useModal()`'s `openName` lets this drawer's own Escape
// handler defer to a ConfirmDelete opened from inside it: when a Modal
// window is open on top of the drawer, Escape must close THAT first, never
// this drawer too.
function DocumentDetailDrawer({
  documentType,
  documents,
  workerId,
  semesterId,
  onView,
  onDownload,
  onGuardChange,
  onRequestClose,
}: DocumentDetailDrawerProps) {
  const allowsMultiple = documentType.allows_multiple;
  const hasExistingDocument = documents.length > 0;
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = `document-detail-drawer-title-${documentType.id}`;
  const { openName: modalOpenName } = useModal();

  // Kept fresh via refs so the mount-scoped accessibility effect below
  // always reads the latest values without needing to be in its
  // dependency array (which would tear down and rebuild the focus
  // trap/scroll lock on every unrelated re-render).
  const modalOpenNameRef = useRef(modalOpenName);
  modalOpenNameRef.current = modalOpenName;
  const onRequestCloseRef = useRef(onRequestClose);
  onRequestCloseRef.current = onRequestClose;

  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singleFileError, setSingleFileError] = useState<string | null>(null);
  const [singleFileInputVersion, setSingleFileInputVersion] = useState(0);

  // Both hook families are called unconditionally (Rules of Hooks) -- only
  // the branch matching this document type's allows_multiple is actually
  // used below; the other sits idle.
  const multi = useUploadWorkerDocuments({
    workerId,
    documentTypeId: documentType.id,
    semesterId,
  });
  const { uploadDocument, isUploading: isSingleUploading } = useUploadWorkerDocument();
  const { replaceDocument, isReplacing } = useReplaceWorkerDocument();
  const { deleteDocument, isDeleting } = useDeleteWorkerDocument();

  const isSingleWorking = isSingleUploading || isReplacing;
  const isBusy = allowsMultiple ? multi.isUploading : isSingleWorking;
  // "Subir N archivos"/footer count -- only what a confirm click would
  // actually attempt to upload (preparado only), unrelated to the
  // discard-confirmation guard below.
  const multiPendingCount = multi.items.filter((item) => item.status === "preparado").length;
  const pendingCount = allowsMultiple ? multiPendingCount : singleFile ? 1 : 0;
  // What would actually be lost if the queue were discarded right now:
  // preparado + error (never completado, whose upload already committed).
  // For single-file, a selected file counts as discardable whether it's
  // still unconfirmed or already failed -- there is no "completado"
  // lingering state for single-file (a successful upload resets
  // singleFile to null via its own onSuccess).
  const multiDiscardableCount = getDiscardableItems(multi.items).length;
  const discardableCount = allowsMultiple ? multiDiscardableCount : singleFile ? 1 : 0;
  const hasPendingSelection = discardableCount > 0;

  // Reports this drawer's current close-guard state (and exactly how many
  // files would be discarded, so the dashboard's confirmation dialog can
  // say precisely that) upward every time either changes -- the dashboard
  // is the one that decides what to do with it (allow immediately, ask
  // for confirmation, or ignore the request outright) for every one of
  // the 6 close/navigate-away triggers.
  useEffect(() => {
    onGuardChange(getDrawerCloseGuard(isBusy, hasPendingSelection), discardableCount);
  }, [isBusy, hasPendingSelection, discardableCount, onGuardChange]);

  // Accessibility: initial focus, focus trap, Escape, body scroll lock,
  // restore focus to whatever had it before the drawer opened. Runs once
  // per mount (this component is remounted, via a `key={documentTypeId}`
  // in the parent, whenever a different requirement is opened -- so this
  // effect's mount/unmount cycle exactly matches "this requirement's
  // drawer session").
  useEffect(() => {
    const previouslyFocusedElement = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const container = panelRef.current;
    const focusable = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? container)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      // A Modal.Window (e.g. the per-file "Eliminar" confirmation) opened
      // from inside this drawer takes priority -- Escape closes it first,
      // never this drawer at the same time. Modal.Window has its own
      // Escape handling (ui/Modal.tsx); this drawer simply steps aside.
      if (modalOpenNameRef.current) return;

      if (event.key === "Escape") {
        event.stopPropagation();
        onRequestCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const current = panelRef.current;
      const focusableEls = Array.from(
        current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
      );
      if (!focusableEls.length) return;
      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocusedElement?.focus?.();
    };
    // Intentionally mount/unmount-scoped only (see comment above) --
    // modalOpenName/onRequestClose are read via refs so this effect never
    // needs to re-run when they change.
  }, []);

  function resetSingleFile() {
    setSingleFile(null);
    setSingleFileError(null);
    setSingleFileInputVersion((version) => version + 1);
  }

  function handleFilesAdded(files: File[]) {
    if (allowsMultiple) {
      multi.addFiles(files);
      return;
    }
    setSingleFile(files[0] ?? null);
    setSingleFileError(null);
  }

  function handleConfirm() {
    if (allowsMultiple) {
      multi.uploadQueuedFiles();
      return;
    }

    if (!singleFile) return;

    const payload = {
      workerId,
      documentTypeId: documentType.id,
      semesterId,
      file: singleFile,
    };
    const mutationOptions = {
      onSuccess: () => resetSingleFile(),
      onError: (error: Error) => {
        setSingleFileError(error?.message || "El archivo no pudo subirse");
      },
    };

    if (hasExistingDocument) {
      replaceDocument(payload, mutationOptions);
    } else {
      uploadDocument(payload, mutationOptions);
    }
  }

  function handleCancel() {
    if (allowsMultiple) {
      multi.clearQueue();
    } else {
      resetSingleFile();
    }
  }

  const sortedDocuments = sortWorkerDocumentsByRecency(documents);
  const confirmLabel = allowsMultiple
    ? `Subir ${multiPendingCount} ${multiPendingCount === 1 ? "archivo" : "archivos"}`
    : hasExistingDocument
      ? "Reemplazar archivo"
      : "Subir archivo";
  const pendingLabel = allowsMultiple
    ? "Subiendo..."
    : hasExistingDocument
      ? "Reemplazando..."
      : "Subiendo...";

  return createPortal(
    <DocumentDetailDrawerView
      panelRef={panelRef}
      titleId={titleId}
      documentType={documentType}
      documents={sortedDocuments}
      allowsMultiple={allowsMultiple}
      isBusy={isBusy}
      isDeleting={isDeleting}
      onDeleteDocument={deleteDocument}
      onView={onView}
      onDownload={onDownload}
      onRequestClose={onRequestClose}
      singleFileInputVersion={singleFileInputVersion}
      existingQueueFiles={
        allowsMultiple
          ? multi.items.map((item) => item.file)
          : singleFile
            ? [singleFile]
            : []
      }
      onFilesAdded={handleFilesAdded}
      multiItems={multi.items}
      onRemoveMultiItem={multi.removeItem}
      onRetryMultiItem={multi.retryItem}
      singleFile={singleFile}
      singleFileError={singleFileError}
      isSingleWorking={isSingleWorking}
      onRemoveSingleFile={resetSingleFile}
      onRetrySingleFile={handleConfirm}
      pendingCount={pendingCount}
      confirmLabel={confirmLabel}
      pendingLabel={pendingLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />,
    document.body
  );
}

export default DocumentDetailDrawer;
export { DocumentDetailDrawerView };
