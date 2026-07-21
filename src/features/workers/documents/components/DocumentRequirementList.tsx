import styled from "styled-components";
import DocumentRequirementRow from "./DocumentRequirementRow";
import type { WorkerDocumentType } from "../useWorkerDocumentCatalog";
import type { WorkerDocument } from "../useWorkerDocuments";

const List = styled.ul`
  display: flex;
  flex-direction: column;
  list-style: none;
  padding: 0;
  margin: 0;
`;

const EmptyState = styled.p`
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-200);
  border-radius: 7px;
  padding: 1.6rem;
  color: var(--color-grey-600);
`;

interface DocumentRequirementListProps {
  documentTypes: WorkerDocumentType[];
  documentsByType: Map<number, WorkerDocument[]>;
  emptyMessage: string;
  onOpenRequirement: (documentTypeId: number) => void;
  disabled?: boolean;
}

// Already-filtered (visibility, status filter, search) document types in --
// this component only renders rows or the empty state, no filtering logic
// of its own. `disabled` (set while the dashboard is showing a previous
// period's placeholder data, see WorkerDocumentsDashboard's
// isUpdatingSemesterData) keeps every row visible as context but makes
// none of them interactive -- rows must never disappear behind a
// full-page spinner for this state.
function DocumentRequirementList({
  documentTypes,
  documentsByType,
  emptyMessage,
  onOpenRequirement,
  disabled = false,
}: DocumentRequirementListProps) {
  if (!documentTypes.length) {
    return <EmptyState>{emptyMessage}</EmptyState>;
  }

  return (
    <List>
      {documentTypes.map((documentType) => (
        <DocumentRequirementRow
          key={documentType.id}
          documentType={documentType}
          documents={documentsByType.get(documentType.id) ?? []}
          onOpen={onOpenRequirement}
          disabled={disabled}
        />
      ))}
    </List>
  );
}

export default DocumentRequirementList;
