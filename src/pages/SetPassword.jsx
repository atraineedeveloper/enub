import { useState } from "react";
import styled from "styled-components";
import Heading from "../ui/Heading";
import Form from "../ui/Form";
import FormRowVertical from "../ui/FormRowVertical";
import Input from "../ui/Input";
import Button from "../ui/Button";
import SpinnerFullPage from "../ui/SpinnerFullPage";
import SpinnerMini from "../ui/SpinnerMini";
import { useUser } from "../features/authentication/useUser";
import { useSetPassword } from "../features/authentication/useSetPassword";

const MIN_PASSWORD_LENGTH = 8;

const PageLayout = styled.main`
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
`;

const Message = styled.p`
  color: var(--color-grey-600);
  font-size: 1.5rem;
`;

// Landing page for a Supabase invitation/recovery link. This page does not
// write to profiles and does not call create-worker-account -- linking
// already happened server-side (create-worker-account -> link_worker_account)
// before the invite was ever sent. This page only ever calls
// supabase.auth.updateUser({ password }) on the session the invite link
// itself already established. See decisions.md #27 for the exact minimum
// scope this page is intentionally limited to.
function SetPassword() {
  const { isLoading: isLoadingUser, isAuthenticated } = useUser();
  const { setPassword, isSettingPassword } = useSetPassword();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();

    if (!newPassword) {
      setFormError("La contraseña es requerida.");
      return;
    }
    if (!confirmPassword) {
      setFormError("Confirma la contraseña.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setFormError(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }

    setFormError("");
    setPassword({ password: newPassword });
  }

  if (isLoadingUser) return <SpinnerFullPage />;

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <Card>
          <Heading as="h4">Enlace inválido o expirado</Heading>
          <Message>
            Este enlace de invitación ya no es válido o expiró. Solicita a un
            administrador que te envíe una nueva invitación.
          </Message>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <Card>
        <Heading as="h4">Activar cuenta</Heading>
        <Message>
          Establece tu contraseña para terminar de activar tu cuenta.
        </Message>
        <Form onSubmit={handleSubmit}>
          <FormRowVertical label="Nueva contraseña">
            <Input
              type="password"
              id="new-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSettingPassword}
            />
          </FormRowVertical>
          <FormRowVertical label="Confirmar contraseña">
            <Input
              type="password"
              id="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSettingPassword}
            />
          </FormRowVertical>
          <FormRowVertical>
            <Button size="large" disabled={isSettingPassword}>
              {!isSettingPassword ? "Guardar contraseña" : <SpinnerMini />}
            </Button>
            {formError && (
              <p style={{ color: "var(--color-red-700)", marginTop: "0.8rem" }}>
                {formError}
              </p>
            )}
          </FormRowVertical>
        </Form>
      </Card>
    </PageLayout>
  );
}

export default SetPassword;
