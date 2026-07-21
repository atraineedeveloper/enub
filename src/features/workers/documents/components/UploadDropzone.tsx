import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import styled from "styled-components";
import { HiOutlineCloudArrowUp } from "react-icons/hi2";
import Button from "../../../../ui/Button";
import {
  ALLOWED_DOCUMENT_TYPES_LABEL,
  DOCUMENT_FILE_INPUT_ACCEPT,
  MAX_FILES_PER_UPLOAD_BATCH,
  MAX_WORKER_DOCUMENT_FILE_SIZE_LABEL,
} from "../../../../services/workerDocumentUploadLimits";
import { resolveFileSelection } from "../resolveFileSelection";

// Compact and flexible, never a full-height/full-width hero: a min-height
// (not a fixed height) so it can still grow for a long rejection message,
// centered content so a short empty state doesn't look sparse.
const Zone = styled.div<{ $isDraggingOver: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  min-height: 12rem;
  padding: 1.6rem;
  text-align: center;
  border: 1.5px dashed
    ${(props) =>
      props.$isDraggingOver ? "var(--color-brand-600)" : "var(--color-grey-300)"};
  border-radius: var(--border-radius-sm);
  background-color: ${(props) =>
    props.$isDraggingOver ? "var(--color-grey-50)" : "var(--color-grey-0)"};
  transition: border-color 0.15s, background-color 0.15s;
`;

// Real, functional file input -- kept in the DOM and fully operable, just
// visually hidden. Never the only way to select files: the visible Button
// below triggers it via ref.click(), the same technique this codebase
// already uses (WorkerDocumentsView.tsx's previous single-file control,
// CreateEditWorkerForm.jsx's profile_picture field), so keyboard users
// reach and activate a real, focusable Button (Tab + Enter/Space), not a
// hidden, unfocusable control.
const HiddenInput = styled.input`
  display: none;
`;

const ZoneIcon = styled(HiOutlineCloudArrowUp)`
  width: 2rem;
  height: 2rem;
  color: var(--color-grey-400);
`;

const DropHint = styled.p`
  color: var(--color-grey-500);
  font-size: 1.3rem;
  margin: 0;
`;

const ZoneHint = styled.p`
  color: var(--color-grey-500);
  font-size: 1.2rem;
  margin: 0;
`;

// role="alert" is itself an implicit assertive live region -- a rejection
// message (invalid type, over size, duplicate, over the per-batch limit)
// is announced to screen reader users without any separate aria-live
// wiring.
const RejectionMessage = styled.p`
  color: var(--color-red-700);
  font-size: 1.3rem;
  margin: 0;
`;

interface UploadDropzoneProps {
  documentTypeId: number;
  documentTypeName: string;
  allowsMultiple: boolean;
  existingQueueFiles: File[];
  disabled?: boolean;
  onFilesAdded: (files: File[]) => void;
}

// Validates and dedupes candidate files (by type/size, then by
// name+size+lastModified against files already in the queue, then against
// the per-batch max) BEFORE ever calling onFilesAdded -- the queue itself
// (useUploadWorkerDocuments, or the single-file local selection state)
// trusts whatever it receives here. `allowsMultiple` only toggles the
// native `multiple` attribute and copy pluralization -- the exact same
// component renders for both single- and multi-file document types
// (DocumentDetailDrawer), never two different dropzone implementations.
function UploadDropzone({
  documentTypeId,
  documentTypeName,
  allowsMultiple,
  existingQueueFiles,
  disabled,
  onFilesAdded,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(
    null
  );
  const inputId = `worker-document-dropzone-${documentTypeId}`;

  function processFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;

    const { accepted, errors } = resolveFileSelection(
      Array.from(fileList),
      existingQueueFiles
    );

    if (accepted.length) onFilesAdded(accepted);
    setRejectionMessage(errors.length ? errors.join(". ") : null);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    processFiles(event.target.files);
    // Reset so selecting the exact same file again after removing it from
    // the queue still fires a change event.
    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!disabled) setIsDraggingOver(true);
  }

  function handleDragLeave() {
    setIsDraggingOver(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    if (disabled) return;
    processFiles(event.dataTransfer.files);
  }

  const selectLabel = allowsMultiple ? "Seleccionar archivos" : "Seleccionar archivo";
  const dropLabel = allowsMultiple ? "o arrástralos aquí" : "o arrástralo aquí";
  const hintText = allowsMultiple
    ? `Tipos permitidos: ${ALLOWED_DOCUMENT_TYPES_LABEL}. Tamaño máximo: ${MAX_WORKER_DOCUMENT_FILE_SIZE_LABEL} por archivo. Hasta ${MAX_FILES_PER_UPLOAD_BATCH} archivos por selección.`
    : `Tipos permitidos: ${ALLOWED_DOCUMENT_TYPES_LABEL}. Tamaño máximo: ${MAX_WORKER_DOCUMENT_FILE_SIZE_LABEL}.`;

  return (
    <div>
      <Zone
        $isDraggingOver={isDraggingOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <ZoneIcon aria-hidden="true" />
        <HiddenInput
          ref={inputRef}
          id={inputId}
          type="file"
          multiple={allowsMultiple}
          accept={DOCUMENT_FILE_INPUT_ACCEPT}
          disabled={disabled}
          aria-label={`${selectLabel} para ${documentTypeName}`}
          onChange={handleInputChange}
        />
        <Button
          type="button"
          variation="secondary"
          size="small"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {selectLabel}
        </Button>
        <DropHint>{dropLabel}</DropHint>
        <ZoneHint>{hintText}</ZoneHint>
      </Zone>
      {rejectionMessage && (
        <RejectionMessage role="alert">{rejectionMessage}</RejectionMessage>
      )}
    </div>
  );
}

export default UploadDropzone;
