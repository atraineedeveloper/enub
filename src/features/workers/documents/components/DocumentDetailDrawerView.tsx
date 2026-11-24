import type { RefObject } from "react";
import styled from "styled-components";
import { HiXMark } from "react-icons/hi2";
import UploadedFileList from "./UploadedFileList";
import UploadDropzone from "./UploadDropzone";
import PendingUploadList, { PendingFileRow } from "./PendingUploadList";
import UploadFooter from "./UploadFooter";
import type { UploadQueueItem } from "../useUploadWorkerDocuments";
import { getRequirementFileCountLabel } from "../documentRequirementSummary";
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
export function DocumentDetailDrawerView({
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

