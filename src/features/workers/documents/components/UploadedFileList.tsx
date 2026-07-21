import styled from "styled-components";
import UploadedFileRow from "./UploadedFileRow";
import type { WorkerDocument } from "../useWorkerDocuments";

// Scrolls internally once there are many files, rather than pushing the
// dropzone/footer further down the drawer.
const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 32rem;
  overflow-y: auto;
`;

const EmptyHint = styled.p`
  color: var(--color-grey-500);
  font-size: 1.3rem;
  margin: 0;
`;

interface UploadedFileListProps {
  documents: WorkerDocument[];
  emptyLabel: string;
  isDeleting: boolean;
  onView: (storagePath: string) => void;
  onDownload: (document: WorkerDocument) => void;
  onDelete: (documentId: number) => void;
}

function UploadedFileList({
  documents,
  emptyLabel,
  isDeleting,
  onView,
  onDownload,
  onDelete,
}: UploadedFileListProps) {
  if (!documents.length) {
    return <EmptyHint>{emptyLabel}</EmptyHint>;
  }

  return (
    <List>
      {documents.map((document) => (
        <UploadedFileRow
          key={document.id}
          document={document}
          isDeleting={isDeleting}
          onView={onView}
          onDownload={onDownload}
          onDelete={onDelete}
        />
      ))}
    </List>
  );
}

export default UploadedFileList;
