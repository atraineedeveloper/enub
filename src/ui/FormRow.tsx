import styled from "styled-components";
import type { ReactElement } from "react";

const StyledFormRow = styled.div<{ $alignTop?: boolean }>`
  display: grid;
  align-items: ${({ $alignTop }) => ($alignTop ? "start" : "center")};
  grid-template-columns: 24rem 1fr 1.2fr;
  gap: 2.4rem;

  padding: 1.2rem 0;

  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    padding-bottom: 0;
  }

  &:not(:last-child) {
    border-bottom: 1px solid var(--color-grey-100);
  }

  &:has(button) {
    display: flex;
    justify-content: flex-end;
    gap: 1.2rem;
  }

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 0.8rem;
    align-items: flex-start;
    padding: 1rem 0;

    &:has(button) {
      justify-content: flex-start;
      flex-wrap: wrap;
    }
  }
`;

const Label = styled.label`
  font-weight: 500;
`;

const Error = styled.span`
  font-size: 1.4rem;
  color: var(--color-red-700);
`;

interface FormRowProps {
  label?: string;
  error?: string;
  alignTop?: boolean;
  children: ReactElement<{ id?: string }>;
}

function FormRow({ label, error, children, alignTop }: FormRowProps) {
  return (
    <StyledFormRow $alignTop={alignTop}>
      {label && <Label htmlFor={children.props.id}>{label}</Label>}
      {children}
      {error && <Error>{error}</Error>}
    </StyledFormRow>
  );
}

export default FormRow;
