import styled from "styled-components";
import Button from "./Button";
import Heading from "./Heading";

interface ConfirmDeleteProps {
  resourceName: string;
  onConfirm: () => void;
  disabled?: boolean;
  onCloseModal?: () => void;
}

const StyledConfirmDelete = styled.div`
  width: 40rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;

  & p {
    color: var(--color-grey-500);
    margin-bottom: 1.2rem;
  }

  & div {
    display: flex;
    justify-content: flex-end;
    gap: 1.2rem;
  }
`;

function ConfirmDelete({
  resourceName,
  onConfirm,
  disabled = false,
  onCloseModal,
}: ConfirmDeleteProps) {
  const handleDelete = () => {
    onConfirm?.();
    onCloseModal?.();
  };

  return (
    <StyledConfirmDelete>
      <Heading as="h3">Eliminar {resourceName}</Heading>
      <p>
        ¿Estas seguro de que quieres eliminar este regitro? Esta accion es
        irreversible
      </p>

      <div>
        <Button
          variation="secondary"
          disabled={disabled}
          onClick={onCloseModal}
        >
          Cancel
        </Button>
        <Button variation="danger" disabled={disabled} onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </StyledConfirmDelete>
  );
}

export default ConfirmDelete;
