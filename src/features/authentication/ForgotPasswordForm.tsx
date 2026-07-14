import { useState, type FormEvent, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import Form from "../../ui/Form";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import FormRowVertical from "../../ui/FormRowVertical";
import SpinnerMini from "../../ui/SpinnerMini";
import { useRequestPasswordRecovery } from "./useRequestPasswordRecovery";

const EMAIL_ERROR_ID = "forgot-password-email-error";

const Message = styled.p`
  color: var(--color-grey-600);
  font-size: 1.5rem;
`;

const BackLink = styled(Link)`
  display: inline-block;
  margin-top: 0.8rem;
  font-size: 1.4rem;
  color: var(--color-brand-600);

  &:hover {
    text-decoration: underline;
  }
`;

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const { requestPasswordRecovery, isRequesting, isSuccess, isRetryLater } =
    useRequestPasswordRecovery();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email) {
      setFormError("Ingresa tu correo.");
      return;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      setFormError("El correo no tiene un formato válido.");
      return;
    }

    setFormError("");
    requestPasswordRecovery(email);
  }

  // Shown regardless of whether the submitted email matches an account --
  // resetPasswordForEmail itself does not distinguish this, and the UI
  // must not add that distinction either (avoids email enumeration).
  if (isSuccess) {
    return (
      <>
        <Message>
          Si el correo está registrado, recibirás un mensaje con
          instrucciones para restablecer tu contraseña.
        </Message>
        <BackLink to="/login">Volver a iniciar sesión</BackLink>
      </>
    );
  }

  return (
    <>
      <Message>
        Ingresa tu correo y te enviaremos instrucciones para restablecer tu
        contraseña.
      </Message>
      <Form onSubmit={handleSubmit}>
        <FormRowVertical label="Correo">
          <Input
            type="email"
            id="email"
            autoComplete="username"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
            disabled={isRequesting}
            aria-invalid={Boolean(formError)}
            aria-describedby={formError ? EMAIL_ERROR_ID : undefined}
          />
        </FormRowVertical>
        <FormRowVertical>
          <Button size="large" disabled={isRequesting}>
            {!isRequesting ? "Enviar instrucciones" : <SpinnerMini />}
          </Button>
          {formError && (
            <p
              id={EMAIL_ERROR_ID}
              role="alert"
              style={{ color: "var(--color-red-700)", marginTop: "0.8rem" }}
            >
              {formError}
            </p>
          )}
          {/* Only ever account-independent (network/unexpected errors --
              see useRequestPasswordRecovery.ts) -- never shown as a result
              of the submitted email's registration status. Guarded on
              !isRequesting so a stale message from a previous attempt
              doesn't linger while a fresh submission is in flight. */}
          {!isRequesting && isRetryLater && (
            <p role="alert" style={{ color: "var(--color-red-700)", marginTop: "0.8rem" }}>
              No pudimos procesar la solicitud. Intenta de nuevo más tarde.
            </p>
          )}
        </FormRowVertical>
      </Form>
      <BackLink to="/login">Volver a iniciar sesión</BackLink>
    </>
  );
}

export default ForgotPasswordForm;
