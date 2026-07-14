import styled from "styled-components";
import Heading from "../ui/Heading";
import ForgotPasswordForm from "../features/authentication/ForgotPasswordForm";

const ForgotPasswordLayout = styled.main`
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
  gap: 1.2rem;
  padding: 2.8rem 2.4rem;
  background: var(--color-grey-0);
  border: 1px solid var(--color-grey-100);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-md);
  text-align: center;

  @media (max-width: 480px) {
    width: 100%;
    padding: 2.2rem 1.8rem;
  }
`;

function ForgotPassword() {
  return (
    <ForgotPasswordLayout>
      <Card>
        <Heading as="h4">Recuperar contraseña</Heading>
        <ForgotPasswordForm />
      </Card>
    </ForgotPasswordLayout>
  );
}

export default ForgotPassword;
