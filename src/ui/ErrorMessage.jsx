import styled from "styled-components";

const StyledErrorMessage = styled.p`
  font-size: 1.6rem;
  font-weight: 500;
  text-align: center;
  margin: 2.4rem;
  color: var(--color-red-700);
  background-color: var(--color-red-100);
  padding: 1.2rem 1.6rem;
  border-radius: var(--border-radius-sm);
`;

function ErrorMessage({ message = "Ocurrió un error al cargar los datos." }) {
  return <StyledErrorMessage>{message}</StyledErrorMessage>;
}

export default ErrorMessage;
