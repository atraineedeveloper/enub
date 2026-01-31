import styled from "styled-components";
import LoginForm from "../features/authentication/LoginForm";
import Heading from "../ui/Heading";

const LoginLayout = styled.main`
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2.4rem;
  background: radial-gradient(circle at 20% 20%, #fce7ef 0, transparent 30%),
    radial-gradient(circle at 80% 0%, #e0f2fe 0, transparent 26%),
    var(--color-grey-50);

  @media (max-width: 768px) {
    padding: 1.6rem;
    background: var(--color-grey-50);
  }
`;

const Card = styled.div`
  width: min(90vw, 48rem);
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2.8rem 2.4rem;
  background: var(--color-grey-0);
  border: 1px solid var(--color-grey-100);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-md);

  @media (max-width: 480px) {
    width: 100%;
    padding: 2.2rem 1.8rem;
  }
`;

function Login() {
  return (
    <LoginLayout>
      <Card>
        <Heading as="h4">Iniciar sesión</Heading>
        <LoginForm />
      </Card>
    </LoginLayout>
  );
}

export default Login;
