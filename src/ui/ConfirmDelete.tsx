import styled from "styled-components";
import UntypedButton from "./Button";
import Heading from "./Heading";
import type { ButtonHTMLAttributes, ComponentType } from "react";

// Button.jsx is a plain, untyped styled-component whose size/variation props
// are only consumed via runtime prop interpolation (see Button.jsx) — this
// local cast describes its real contract without converting that file.
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "small" | "medium" | "large";
  variation?: "primary" | "secondary" | "danger";
};
const Button = UntypedButton as ComponentType<ButtonProps>;

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

interface ConfirmDeleteProps {
  resourceName: string;
  onConfirm?: () => void;
  disabled?: boolean;
  onCloseModal?: () => void;
}

function ConfirmDelete({
  resourceName,
  onConfirm,
  disabled,
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
