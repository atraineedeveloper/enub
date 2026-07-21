import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { HiXMark } from "react-icons/hi2";
import { useModal } from "../../../../ui/useModal";
import UploadedFileList from "./UploadedFileList";
import UploadDropzone from "./UploadDropzone";
import PendingUploadList, { PendingFileRow } from "./PendingUploadList";
import UploadFooter from "./UploadFooter";
import { useUploadWorkerDocument } from "../useUploadWorkerDocument";
import { useReplaceWorkerDocument } from "../useReplaceWorkerDocument";
import { useDeleteWorkerDocument } from "../useDeleteWorkerDocument";
import {
  getDiscardableItems,
  useUploadWorkerDocuments,
  type UploadQueueItem,
} from "../useUploadWorkerDocuments";
import {
  getDrawerCloseGuard,
  getRequirementFileCountLabel,
  sortWorkerDocumentsByRecency,
  type DrawerCloseGuard,
} from "../documentRequirementSummary";
import type { WorkerDocumentType } from "../useWorkerDocumentCatalog";
import type { WorkerDocument } from "../useWorkerDocuments";

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background-color: var(--backdrop-color, rgba(0, 0, 0, 0.4));
  z-index: 900;

  @media (max-width: 640px) {
    display: none;
  }
`;

// Desktop/tablet: fixed to the right edge, 42-48rem wide (clamped so it
// never overflows a narrower tablet viewport); the page behind stays
// visible and scrollable in its own right (body scroll is locked instead,
// see useEffect below, so only the drawer itself scrolls).
// Mobile: full screen, position fixed inset 0, 100dvh -- not 100vh, which
// on mobile browsers includes space the address bar can cover.
const Panel = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(46rem, 92vw);
  max-width: 48rem;
  min-width: 42rem;
  background-color: var(--color-grey-0);
  box-shadow: var(--shadow-lg);
  z-index: 901;
  display: flex;
  flex-direction: column;
  outline: none;

  @media (max-width: 640px) {
    width: 100%;
    max-width: none;
    min-width: 0;
    height: 100dvh;
    inset: 0;
  }
`;

const Header = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.2rem;
  padding: 1.6rem 2rem;
  border-bottom: 1px solid var(--color-grey-200);
`;

const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
`;

const Title = styled.h2`
  font-size: 1.7rem;
  font-weight: 600;
  color: var(--color-grey-800);
  overflow-wrap: anywhere;
`;

// The catalog's editorial description (worker_document_types.description)
// -- distinct from UploadRule below (the single/multiple-file functional
// hint): one is editorial content about what the requirement IS, the
// other is a rule about how uploading it WORKS. Rendered only when
// present -- never a placeholder, never a generic fallback for null/empty.
const TypeDescription = styled.p`
  color: var(--color-grey-500);
  font-size: 1.3rem;
  margin: 0;
`;

// The functional single-vs-multiple-file hint -- kept as its own element,
// separate from TypeDescription above.
const UploadRule = styled.p`
  color: var(--color-grey-500);
  font-size: 1.3rem;
  margin: 0;
`;

const FileCountLine = styled.p`
  color: var(--color-grey-600);
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0;
`;

const CloseButton = styled.button`
  flex-shrink: 0;
  border: none;
  background: none;
  padding: 0.6rem;
  border-radius: var(--border-radius-sm);
  min-width: 4.4rem;
  min-height: 4.4rem;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background-color: var(--color-grey-100);
  }

  & svg {
    width: 2.2rem;
    height: 2.2rem;
    color: var(--color-grey-500);
  }
`;

const Body = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
`;

const UploadSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ReplaceWarning = styled.p`
  color: var(--color-yellow-700);
  background-color: var(--color-yellow-100);
  border-radius: var(--border-radius-sm);
  padding: 0.8rem 1.2rem;
  font-size: 1.3rem;
  margin: 0;
`;

const InactiveNote = styled.p`
  color: var(--color-grey-500);
  font-size: 1.3rem;
  font-style: italic;
`;

const Footer = styled.div`
  flex-shrink: 0;
  padding: 1.6rem 2rem;
  padding-bottom: calc(1.6rem + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--color-grey-200);
`;

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

interface DocumentDetailDrawerViewProps {
  panelRef: RefObject<HTMLDivElement>;
  titleId: string;
  documentType: WorkerDocumentType;
  documents: WorkerDocument[];
  allowsMultiple: boolean;
  isBusy: boolean;
  isDeleting: boolean;
  onDeleteDocument: (documentId: number) => void;
  onView: (storagePath: string) => void;
  onDownload: (document: WorkerDocument) => void;
  onRequestClose: () => void;
  singleFileInputVersion: number;
  existingQueueFiles: File[];
  onFilesAdded: (files: File[]) => void;
  multiItems: UploadQueueItem[];
  onRemoveMultiItem: (itemId: string) => void;
  onRetryMultiItem: (itemId: string) => void;
  singleFile: File | null;
  singleFileError: string | null;
  isSingleWorking: boolean;
  onRemoveSingleFile: () => void;
  onRetrySingleFile: () => void;
  pendingCount: number;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// The drawer's entire rendered content, deliberately separated from the
// portal call above: createPortal needs a real `document.body` (absent in
// this project's test environment, which has no jsdom/happy-dom -- see
// this codebase's established renderToStaticMarkup-only testing
// convention), so this presentational half is what
// DocumentDetailDrawer.test.tsx actually renders directly, unportaled.
function DocumentDetailDrawerView({
  panelRef,
  titleId,
  documentType,
  documents,
  allowsMultiple,
  isBusy,
  isDeleting,
  onDeleteDocument,
  onView,
  onDownload,
  onRequestClose,
  singleFileInputVersion,
  existingQueueFiles,
  onFilesAdded,
  multiItems,
  onRemoveMultiItem,
  onRetryMultiItem,
  singleFile,
  singleFileError,
  isSingleWorking,
  onRemoveSingleFile,
  onRetrySingleFile,
  pendingCount,
  confirmLabel,
  pendingLabel,
  onConfirm,
  onCancel,
}: DocumentDetailDrawerViewProps) {
  const hasExistingDocument = documents.length > 0;
  const description = documentType.description?.trim();

  return (
    <>
      <Overlay onClick={onRequestClose} />
      <Panel
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <Header>
          <HeaderText>
            <Title id={titleId}>{documentType.name}</Title>
            {description && <TypeDescription>{description}</TypeDescription>}
            <UploadRule>
              {allowsMultiple
                ? "Puedes adjuntar varios archivos."
                : "Se admite un archivo."}
            </UploadRule>
            <FileCountLine aria-live="polite">
              {getRequirementFileCountLabel(documents.length)} cargado
              {documents.length === 1 ? "" : "s"}
            </FileCountLine>
          </HeaderText>
          <CloseButton type="button" aria-label="Cerrar" onClick={onRequestClose}>
            <HiXMark aria-hidden="true" />
          </CloseButton>
        </Header>

        <Body>
          <UploadedFileList
            documents={documents}
            emptyLabel="Aún no has subido archivos para este documento."
            isDeleting={isDeleting}
            onView={onView}
            onDownload={onDownload}
            onDelete={onDeleteDocument}
          />

          {documentType.is_active && (
            <UploadSection aria-live="polite">
              {!allowsMultiple && hasExistingDocument && (
                <ReplaceWarning role="status">
                  Subir un nuevo archivo reemplazará el documento actual.
                </ReplaceWarning>
              )}

              <UploadDropzone
                key={allowsMultiple ? "multi" : singleFileInputVersion}
                documentTypeId={documentType.id}
                documentTypeName={documentType.name}
                allowsMultiple={allowsMultiple}
                existingQueueFiles={existingQueueFiles}
                disabled={isBusy}
                onFilesAdded={onFilesAdded}
              />

              {allowsMultiple ? (
                <PendingUploadList
                  items={multiItems}
                  onRemove={onRemoveMultiItem}
                  onRetry={onRetryMultiItem}
                />
              ) : (
                singleFile && (
                  <PendingFileRow
                    file={singleFile}
                    status={isSingleWorking ? "subiendo" : singleFileError ? "error" : "preparado"}
                    errorMessage={singleFileError ?? undefined}
                    onRemove={!isSingleWorking ? onRemoveSingleFile : undefined}
                    onRetry={singleFileError ? onRetrySingleFile : undefined}
                  />
                )
              )}
            </UploadSection>
          )}

          {!documentType.is_active && (
            <InactiveNote>
              Este requisito ya no acepta nuevas cargas; los archivos ya cargados
              permanecen disponibles arriba.
            </InactiveNote>
          )}
        </Body>

        {documentType.is_active && (
          <Footer>
            <UploadFooter
              pendingCount={pendingCount}
              isUploading={isBusy}
              confirmLabel={confirmLabel}
              pendingLabel={pendingLabel}
              onConfirm={onConfirm}
              onCancel={onCancel}
              cancelDisabled={isBusy}
            />
          </Footer>
        )}
      </Panel>
    </>
  );
}

export default DocumentDetailDrawer;
export { DocumentDetailDrawerView };
