import styled from "styled-components";
import Heading from "../ui/Heading";

// Rendered inside WorkerAppLayout's Main, which already provides the header
// and its Logout action -- this only needs its own centered message card.
const Card = styled.div`
  width: min(90vw, 48rem);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  padding: 2.8rem 2.4rem;
  background: var(--color-grey-0);
  border: 1px solid var(--color-grey-100);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-md);
  text-align: center;
`;

const Message = styled.p`
  color: var(--color-grey-600);
  font-size: 1.6rem;
`;

function PendingAccess() {
  return (
    <Card>
      <Heading as="h4">Acceso pendiente</Heading>
      <Message>
        Tu cuenta no tiene acceso asignado todavía. Contacta a un
        administrador.
      </Message>
    </Card>
  );
}

export default PendingAccess;
