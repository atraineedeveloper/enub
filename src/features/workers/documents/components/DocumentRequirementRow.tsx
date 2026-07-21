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
const Row = styled.li<{ $disabled: boolean }>`
  display: flex;
  align-items: center;
  gap: 1.2rem;
  padding: 1.2rem 0.4rem;
  border-bottom: 1px solid var(--color-grey-100);
  opacity: ${(props) => (props.$disabled ? 0.55 : 1)};

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

  &:disabled {
    cursor: not-allowed;
  }

  &:disabled:hover {
    color: var(--color-grey-800);
  }
`;

const MetaLine = styled.span`
  color: var(--color-grey-500);
  font-size: 1.2rem;
`;

// The catalog's editorial description (worker_document_types.description),
// distinct from the file-count/last-upload metadata below it -- rendered
// only when present (never a placeholder, never a generic fallback phrase
// for null/empty, see documentRequirementSummary.ts's module comment on
// this same distinction in the drawer).
const DescriptionLine = styled.span`
  color: var(--color-grey-500);
  font-size: 1.2rem;
  overflow-wrap: anywhere;
`;

const ActionButton = styled(Button)`
  flex-shrink: 0;
  white-space: nowrap;
`;

interface DocumentRequirementRowProps {
  documentType: WorkerDocumentType;
  documents: WorkerDocument[];
  onOpen: (documentTypeId: number) => void;
  disabled?: boolean;
}

function DocumentRequirementRow({
  documentType,
  documents,
  onOpen,
  disabled = false,
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
  const description = documentType.description?.trim();

  function handleOpen() {
    onOpen(documentType.id);
  }

  return (
    <Row $disabled={disabled} aria-disabled={disabled}>
      <StatusIconWrapper $tone={tone} aria-hidden="true">
        {tone === "covered" && <HiCheckCircle />}
        {tone === "pending" && <HiOutlineClock />}
        {tone === "inactive" && <HiLockClosed />}
      </StatusIconWrapper>
      <Details>
        <NameButton type="button" onClick={handleOpen} disabled={disabled}>
          {documentType.name}
        </NameButton>
        {description && <DescriptionLine>{description}</DescriptionLine>}
        <MetaLine>
          {getRequirementFileCountLabel(documentCount)} · {lastUploadText}
        </MetaLine>
      </Details>
      <ActionButton
        type="button"
        size="small"
        variation={documentCount > 0 ? "secondary" : "primary"}
        onClick={handleOpen}
        disabled={disabled}
      >
        {actionLabel}
      </ActionButton>
    </Row>
  );
}

export default DocumentRequirementRow;
