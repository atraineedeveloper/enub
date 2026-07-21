import styled from "styled-components";
import { HiArrowDownTray, HiEye, HiTrash } from "react-icons/hi2";
import FileTypeIcon from "./FileTypeIcon";
import Modal from "../../../../ui/Modal";
import ConfirmDelete from "../../../../ui/ConfirmDelete";
import {
  formatWorkerDocumentDate,
  formatWorkerDocumentFileSize,
  getWorkerDocumentFileExtension,
} from "../workerDocumentDisplay";
import type { WorkerDocument } from "../useWorkerDocuments";

// A compact row, not a card: icon, name, meta, and actions all on one line
// on desktop, wrapping (never scrolling horizontally) on narrow viewports.
const Row = styled.li`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 1rem;
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-sm);
  background-color: var(--color-grey-0);
  flex-wrap: wrap;
`;

const IconWrapper = styled.div`
  flex-shrink: 0;
  display: flex;
  color: var(--color-grey-500);

  & svg {
    width: 2rem;
    height: 2rem;
  }
`;

const Details = styled.div`
  flex: 1 1 16rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
`;

const FileName = styled.span`
  color: var(--color-grey-700);
  font-weight: 500;
  overflow-wrap: anywhere;
`;

const Meta = styled.span`
  color: var(--color-grey-500);
  font-size: 1.2rem;
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
  flex-shrink: 0;
`;

// Icon + visible text on desktop (never icon-only there); the text
// collapses at narrow widths, but aria-label and title (tooltip) are
// always present regardless of viewport, so the action stays identifiable
// either way.
const ActionButton = styled.button`
  border: none;
  background: none;
  color: var(--color-brand-600);
  font-size: 1.3rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 3.6rem;
  min-width: 3.6rem;
  padding: 0.4rem 0.8rem;
  border-radius: var(--border-radius-sm);

  &:hover {
    color: var(--color-brand-700);
    background-color: var(--color-grey-50);
  }

  & svg {
    width: 1.6rem;
    height: 1.6rem;
    flex-shrink: 0;
  }

  @media (max-width: 480px) {
    padding: 0.4rem;
  }
`;

const ActionLabel = styled.span`
  @media (max-width: 480px) {
    display: none;
  }
`;

const DangerActionButton = styled(ActionButton)`
  color: var(--color-red-700);

  &:hover {
    color: var(--color-red-800);
    background-color: var(--color-grey-50);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

interface UploadedFileRowProps {
  document: WorkerDocument;
  isDeleting: boolean;
  onView: (storagePath: string) => void;
  onDownload: (document: WorkerDocument) => void;
  onDelete: (documentId: number) => void;
}

// One uploaded file, independent of however many siblings share its
// document type -- ver/descargar/eliminar all act on this file's own id,
// never on the type as a whole, so this row is identical whether it's the
// only file for a single-file type or one of several for a multi-file type.
function UploadedFileRow({
  document,
  isDeleting,
  onView,
  onDownload,
  onDelete,
}: UploadedFileRowProps) {
  const extension = getWorkerDocumentFileExtension(document.file_name);
  const metaParts = [
    extension,
    formatWorkerDocumentFileSize(document.file_size),
    formatWorkerDocumentDate(document.created_at),
  ].filter(Boolean);

  return (
    <Row>
      <IconWrapper>
        <FileTypeIcon fileName={document.file_name} />
      </IconWrapper>
      <Details>
        <FileName title={document.file_name}>{document.file_name}</FileName>
        {metaParts.length > 0 && <Meta>{metaParts.join(" · ")}</Meta>}
      </Details>
      <Actions>
        <ActionButton
          type="button"
          aria-label={`Ver ${document.file_name}`}
          title={`Ver ${document.file_name}`}
          onClick={() => onView(document.storage_path)}
        >
          <HiEye aria-hidden="true" /> <ActionLabel>Ver</ActionLabel>
        </ActionButton>
        <ActionButton
          type="button"
          aria-label={`Descargar ${document.file_name}`}
          title={`Descargar ${document.file_name}`}
          onClick={() => onDownload(document)}
        >
          <HiArrowDownTray aria-hidden="true" /> <ActionLabel>Descargar</ActionLabel>
        </ActionButton>
        <Modal.Open opens={`delete-worker-document-${document.id}`}>
          <DangerActionButton
            type="button"
            aria-label={`Eliminar ${document.file_name}`}
            title={`Eliminar ${document.file_name}`}
            disabled={isDeleting}
          >
            <HiTrash aria-hidden="true" /> <ActionLabel>Eliminar</ActionLabel>
          </DangerActionButton>
        </Modal.Open>
        <Modal.Window
          name={`delete-worker-document-${document.id}`}
          title={`Eliminar ${document.file_name}`}
        >
          <ConfirmDelete
            resourceName={document.file_name}
            disabled={isDeleting}
            onConfirm={() => onDelete(document.id)}
          />
        </Modal.Window>
      </Actions>
    </Row>
  );
}

export default UploadedFileRow;
