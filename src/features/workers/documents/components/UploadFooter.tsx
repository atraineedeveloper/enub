import styled from "styled-components";
import { HiArrowPath, HiArrowUpTray } from "react-icons/hi2";
import Button from "../../../../ui/Button";

const FooterBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.2rem;
`;

const Counter = styled.span`
  color: var(--color-grey-600);
  font-size: 1.3rem;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 1.2rem;
  margin-left: auto;
`;

const ConfirmButton = styled(Button)`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;

  &:disabled {
    opacity: 0.5;
    box-shadow: none;
    cursor: not-allowed;
  }
`;

const CancelButton = styled(Button)`
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

interface UploadFooterProps {
  pendingCount: number;
  isUploading: boolean;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  cancelDisabled: boolean;
}

// One shared footer for both single- and multi-file drawers -- generalizes
// the previous iteration's UploadSummary (counter + confirm) plus a
// Cancelar action, kept in one component so both paths get identical
// visual chrome. Renders nothing when there is genuinely nothing to
// confirm or cancel (no pending selection, not uploading) -- "footer fijo
// solo cuando haya acciones".
function UploadFooter({
  pendingCount,
  isUploading,
  confirmLabel,
  pendingLabel,
  onConfirm,
  onCancel,
  cancelDisabled,
}: UploadFooterProps) {
  if (pendingCount === 0 && !isUploading) return null;

  return (
    <FooterBar>
      {pendingCount > 0 && (
        <Counter>
          {pendingCount} {pendingCount === 1 ? "archivo seleccionado" : "archivos seleccionados"}
        </Counter>
      )}
      <Actions>
        <CancelButton
          type="button"
          variation="secondary"
          size="small"
          disabled={cancelDisabled}
          onClick={onCancel}
        >
          Cancelar
        </CancelButton>
        <ConfirmButton
          type="button"
          size="small"
          disabled={pendingCount === 0 || isUploading}
          onClick={onConfirm}
        >
          {isUploading ? <HiArrowPath aria-hidden="true" /> : <HiArrowUpTray aria-hidden="true" />}
          {isUploading ? pendingLabel : confirmLabel}
        </ConfirmButton>
      </Actions>
    </FooterBar>
  );
}

export default UploadFooter;
