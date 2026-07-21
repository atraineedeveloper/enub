import styled from "styled-components";
import { HiCheckCircle, HiLockClosed, HiOutlineClock } from "react-icons/hi2";
import Button from "../../../../ui/Button";
import {
  getLatestUploadDate,
  getRequirementActionLabel,
  getRequirementFileCountLabel,
} from "../documentRequirementSummary";
import { formatWorkerDocumentDate } from "../workerDocumentDisplay";
import type { WorkerDocumentType } from "../useWorkerDocumentCatalog";
import type { WorkerDocument } from "../useWorkerDocuments";

// A single compact row, ~80px tall (padding + line-heights, no fixed
// height so long names can still wrap without clipping) -- never a card.
const Row = styled.li`
  display: flex;
  align-items: center;
  gap: 1.2rem;
  padding: 1.2rem 0.4rem;
  border-bottom: 1px solid var(--color-grey-100);

  &:last-child {
    border-bottom: none;
  }
`;

// Status is conveyed by icon SHAPE (check / clock / lock), not color
// alone -- color is a reinforcing signal, never the only one.
const StatusIconWrapper = styled.div<{ $tone: "covered" | "pending" | "inactive" }>`
  flex-shrink: 0;
  display: flex;
  color: ${(props) =>
    props.$tone === "covered"
      ? "var(--color-green-600)"
      : props.$tone === "pending"
        ? "var(--color-yellow-600)"
        : "var(--color-grey-400)"};

  & svg {
    width: 2rem;
    height: 2rem;
  }
`;

const Details = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

// The name doubles as an accessible secondary entry point into the same
// action (opening the drawer) -- never the whole row as one ambiguous
// clickable surface.
const NameButton = styled.button`
  border: none;
  background: none;
  padding: 0;
  text-align: left;
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--color-grey-800);
  overflow-wrap: anywhere;

  &:hover {
    color: var(--color-brand-700);
  }
`;

const MetaLine = styled.span`
  color: var(--color-grey-500);
  font-size: 1.2rem;
`;

const ActionButton = styled(Button)`
  flex-shrink: 0;
  white-space: nowrap;
`;

interface DocumentRequirementRowProps {
  documentType: WorkerDocumentType;
  documents: WorkerDocument[];
  onOpen: (documentTypeId: number) => void;
}

function DocumentRequirementRow({
  documentType,
  documents,
  onOpen,
}: DocumentRequirementRowProps) {
  const documentCount = documents.length;
  const tone = !documentType.is_active
    ? "inactive"
    : documentCount > 0
      ? "covered"
      : "pending";
  const latestUploadDate = getLatestUploadDate(documents);
  const lastUploadText = latestUploadDate
    ? `Última carga: ${formatWorkerDocumentDate(latestUploadDate)}`
    : "Sin archivos cargados";
  const actionLabel = getRequirementActionLabel(
    documentType.is_active,
    documentType.allows_multiple,
    documentCount
  );

  function handleOpen() {
    onOpen(documentType.id);
  }

  return (
    <Row>
      <StatusIconWrapper $tone={tone} aria-hidden="true">
        {tone === "covered" && <HiCheckCircle />}
        {tone === "pending" && <HiOutlineClock />}
        {tone === "inactive" && <HiLockClosed />}
      </StatusIconWrapper>
      <Details>
        <NameButton type="button" onClick={handleOpen}>
          {documentType.name}
        </NameButton>
        <MetaLine>
          {getRequirementFileCountLabel(documentCount)} · {lastUploadText}
        </MetaLine>
      </Details>
      <ActionButton
        type="button"
        size="small"
        variation={documentCount > 0 ? "secondary" : "primary"}
        onClick={handleOpen}
      >
        {actionLabel}
      </ActionButton>
    </Row>
  );
}

export default DocumentRequirementRow;
