import { ReactElement } from "react";
import styled from "styled-components";

const StyledFormRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1.2rem 0;
`;

const Label = styled.label`
  font-weight: 500;
`;

const Error = styled.span`
  font-size: 1.4rem;
  color: var(--color-red-700);
`;

import type { ReactNode } from "react";

interface FormRowVerticalProps {
  label?: string;
  error?: string;
  children: ReactElement | ReactNode;
}

function FormRowVertical({ label, error, children }: FormRowVerticalProps) {
  const childId =
    typeof children === "object" && children && "props" in children
      ? (children as ReactElement).props.id
      : undefined;

  return (
    <StyledFormRow>
      {label && <Label htmlFor={childId}>{label}</Label>}
      {children}
      {error && <Error>{error}</Error>}
    </StyledFormRow>
  );
}

export default FormRowVertical;
