import styled from "styled-components";
import { HiOutlineArrowPath, HiOutlineXMark } from "react-icons/hi2";
import FileTypeIcon from "./FileTypeIcon";
import { formatWorkerDocumentFileSize } from "../workerDocumentDisplay";
import type { UploadQueueItem, UploadQueueItemStatus } from "../useUploadWorkerDocuments";

const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  list-style: none;
  padding: 0;
  margin: 0;
`;

const Item = styled.li`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem 1rem;
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-sm);
  background-color: var(--color-grey-0);
`;

const IconWrapper = styled.div`
  flex-shrink: 0;
  display: flex;
  color: var(--color-grey-500);

  & svg {
    width: 1.8rem;
    height: 1.8rem;
  }
`;

const Details = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

const FileName = styled.span`
  color: var(--color-grey-700);
  font-size: 1.3rem;
  overflow-wrap: anywhere;
`;

const StatusText = styled.span<{ $status: UploadQueueItemStatus }>`
  font-size: 1.2rem;
  color: ${(props) =>
    props.$status === "error"
      ? "var(--color-red-700)"
      : props.$status === "completado"
        ? "var(--color-green-700)"
        : "var(--color-grey-500)"};
`;

const ItemActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
`;

// 36px visual box on a 1.8rem icon, which combined with padding keeps the
// tap target close to the 44px guideline without inflating a dense list.
const IconButton = styled.button`
  border: none;
  background: none;
  color: var(--color-grey-500);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.6rem;
  height: 3.6rem;
  border-radius: var(--border-radius-sm);

  &:hover {
    background-color: var(--color-grey-100);
    color: var(--color-grey-700);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  & svg {
    width: 1.8rem;
    height: 1.8rem;
  }
`;

const RetryButton = styled(IconButton)`
  color: var(--color-brand-600);

  &:hover {
    color: var(--color-brand-700);
    background-color: var(--color-grey-100);
  }
`;

const STATUS_LABEL: Record<UploadQueueItemStatus, string> = {
  preparado: "Preparado",
  subiendo: "Subiendo...",
  completado: "Completado",
  error: "Error",
};

export interface PendingFileRowProps {
  file: File;
  status: UploadQueueItemStatus;
  errorMessage?: string;
  onRemove?: () => void;
  onRetry?: () => void;
}

// One queued file's compact row -- shared between the multi-file queue
// (PendingFileList below, one row per UploadQueueItem) and the single-file
// panel (which renders exactly one of these directly, no list/queue
// abstraction needed for a single pending selection).
export function PendingFileRow({
  file,
  status,
  errorMessage,
  onRemove,
  onRetry,
}: PendingFileRowProps) {
  return (
    <Item>
      <IconWrapper>
        <FileTypeIcon fileName={file.name} />
      </IconWrapper>
      <Details>
        <FileName title={file.name}>{file.name}</FileName>
        <StatusText $status={status}>
          {STATUS_LABEL[status]}
          {status === "error" && errorMessage
            ? ` — ${errorMessage}`
            : ` · ${formatWorkerDocumentFileSize(file.size)}`}
        </StatusText>
      </Details>
      <ItemActions>
        {status === "error" && onRetry && (
          <RetryButton
            type="button"
            aria-label={`Reintentar ${file.name}`}
            title={`Reintentar ${file.name}`}
            onClick={onRetry}
          >
            <HiOutlineArrowPath aria-hidden="true" />
          </RetryButton>
        )}
        {(status === "preparado" || status === "error") && onRemove && (
          <IconButton
            type="button"
            aria-label={`Retirar ${file.name} de la cola`}
            title={`Retirar ${file.name} de la cola`}
            onClick={onRemove}
          >
            <HiOutlineXMark aria-hidden="true" />
          </IconButton>
        )}
      </ItemActions>
    </Item>
  );
}

interface PendingUploadListProps {
  items: UploadQueueItem[];
  onRemove: (itemId: string) => void;
  onRetry: (itemId: string) => void;
}

// aria-live="polite" on the list itself means every status transition
// (preparado -> subiendo -> completado/error) is announced to screen
// reader users as it happens, without any separate live-region element.
function PendingUploadList({ items, onRemove, onRetry }: PendingUploadListProps) {
  if (!items.length) return null;

  return (
    <List aria-live="polite">
      {items.map((item) => (
        <PendingFileRow
          key={item.id}
          file={item.file}
          status={item.status}
          errorMessage={item.errorMessage}
          onRemove={() => onRemove(item.id)}
          onRetry={() => onRetry(item.id)}
        />
      ))}
    </List>
  );
}

export default PendingUploadList;
