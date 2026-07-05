import styled from "styled-components";
import { isValidElement, type ReactNode } from "react";

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

interface FormRowVerticalProps {
  label?: string;
  error?: string;
  children: ReactNode;
}

function FormRowVertical({ label, error, children }: FormRowVerticalProps) {
  const htmlFor = isValidElement<{ id?: string }>(children)
    ? children.props.id
    : undefined;

  return (
    <StyledFormRow>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error && <Error>{error}</Error>}
    </StyledFormRow>
  );
}

export default FormRowVertical;
