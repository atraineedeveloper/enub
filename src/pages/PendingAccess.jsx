import styled from "styled-components";
import Heading from "../ui/Heading";
import Logout from "../features/authentication/Logout";

const PendingAccessLayout = styled.main`
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2.4rem;
  background-color: var(--color-grey-50);
`;

const Card = styled.div`
  width: min(90vw, 48rem);
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
    <PendingAccessLayout>
      <Card>
        <Heading as="h4">Acceso pendiente</Heading>
        <Message>
          Tu cuenta no tiene acceso asignado todavía. Contacta a un
          administrador.
        </Message>
        <Logout />
      </Card>
    </PendingAccessLayout>
  );
}

export default PendingAccess;
