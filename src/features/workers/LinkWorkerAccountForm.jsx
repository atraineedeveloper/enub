import { useForm } from "react-hook-form";
import styled from "styled-components";
import Form from "../../ui/Form";
import FormRow from "../../ui/FormRow";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import { useLinkWorkerAccount } from "../authentication/useLinkWorkerAccount";

const Hint = styled.p`
  font-size: 1.3rem;
  color: var(--color-grey-500);
  margin-bottom: 1.6rem;
`;

// eslint-disable-next-line react/prop-types -- workerId is a plain number, onCloseModal is injected by Modal.Window
function LinkWorkerAccountForm({ workerId, onCloseModal }) {
  const { register, handleSubmit, reset, formState } = useForm();
  const { errors } = formState;
  const { isLinking, linkAccount } = useLinkWorkerAccount();

  function onSubmit(data) {
    linkAccount(
      { workerId, email: data.email.trim() },
      {
        onSuccess: () => {
          reset();
          onCloseModal?.();
        },
      }
    );
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <Hint>
        La cuenta de acceso debe haberse creado antes en Supabase Studio
        (Authentication). Aquí solo se vincula ese correo con este
        trabajador.
      </Hint>
      <FormRow label="Correo de la cuenta" error={errors?.email?.message}>
        <Input
          type="email"
          id="email"
          placeholder="trabajador@ejemplo.com"
          disabled={isLinking}
          {...register("email", {
            required: "Este campo es requerido",
          })}
        />
      </FormRow>
      <FormRow>
        <Button
          variation="secondary"
          type="reset"
          onClick={() => onCloseModal?.()}
          disabled={isLinking}
        >
          Cancelar
        </Button>
        <Button disabled={isLinking}>Vincular cuenta</Button>
      </FormRow>
    </Form>
  );
}

export default LinkWorkerAccountForm;
