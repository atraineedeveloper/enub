import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import styled from "styled-components";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import { useWorkerAccessEmailContext } from "../authentication/useWorkerAccessEmailContext";
import { useResendWorkerAccessLink } from "../authentication/useResendWorkerAccessLink";
import type { WorkerAccessEmailCorrectionResult } from "../../services/apiProfiles";

// A dedicated dialog, NOT src/ui/Modal.tsx and not a modification of it
// (design.md §15, add-worker-access-email-correction): that component has
// no dialog role/ARIA wiring, no focus trap, no initial-focus management,
// no focus restoration, and no Escape handling. This one feature-detects
// the native <dialog>/showModal() and falls back to a plain, clearly
// non-modal inline block when unsupported.

const supportsNativeDialog =
  typeof HTMLDialogElement !== "undefined" &&
  typeof HTMLDialogElement.prototype.showModal === "function";

// Finding #12: box-sizing: border-box on both, so padding is included in
// the width/max-width budget rather than added on top of it -- without
// this, "width: 90vw" plus 4rem of horizontal padding can exceed the
// viewport's own width on narrow screens (checked at 320-375px).
const StyledDialog = styled.dialog`
  box-sizing: border-box;
  border: none;
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 3.2rem 4rem;
  max-width: min(52rem, calc(100vw - 3.2rem));
  width: 90vw;

  @media (max-width: 480px) {
    padding: 2rem 1.6rem;
  }

  &::backdrop {
    background-color: var(--backdrop-color);
    backdrop-filter: blur(4px);
  }
`;

const FallbackPanel = styled.div`
  box-sizing: border-box;
  border: 1px solid var(--color-grey-300);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-md);
  padding: 3.2rem 4rem;
  max-width: min(52rem, calc(100vw - 3.2rem));
  margin: 1.6rem 0;

  @media (max-width: 480px) {
    padding: 2rem 1.6rem;
  }
`;

const Heading = styled.h3`
  margin-bottom: 0.8rem;
`;

const Description = styled.p`
  font-size: 1.3rem;
  color: var(--color-grey-500);
  margin-bottom: 1.6rem;
`;

const FieldGroup = styled.div`
  margin-bottom: 1.6rem;
`;

const FieldLabel = styled.label`
  display: block;
  font-weight: 500;
  margin-bottom: 0.4rem;
`;

// Finding #12: the browser's default input sizing (~20 characters) can
// exceed a narrow (320-375px) viewport once the dialog's own padding is
// accounted for -- an explicit full-width, border-box input avoids that.
const FullWidthInput = styled(Input)`
  box-sizing: border-box;
  width: 100%;
`;

const StaticValue = styled.p`
  font-size: 1.4rem;
  overflow-wrap: anywhere;
`;

const RevealRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.2rem;
`;

const Warning = styled.p`
  font-size: 1.3rem;
  color: var(--color-yellow-700, #92400e);
  background-color: var(--color-yellow-100, #fef3c7);
  border-radius: var(--border-radius-sm);
  padding: 0.8rem 1.2rem;
  margin-bottom: 1.6rem;
`;

const StatusBanner = styled.p<{ $tone: "success" | "error" }>`
  font-size: 1.4rem;
  border-radius: var(--border-radius-sm);
  padding: 1.2rem;
  margin-bottom: 1.6rem;
  color: ${(props) =>
    props.$tone === "success"
      ? "var(--color-green-700)"
      : "var(--color-red-700)"};
  background-color: ${(props) =>
    props.$tone === "success"
      ? "var(--color-green-100)"
      : "var(--color-red-100)"};
`;

// Finding #12: the action row wraps/stacks rather than overflowing on
// narrow screens (checked at 320-375px).
const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 1.2rem;
  margin-top: 2.4rem;

  @media (max-width: 480px) {
    justify-content: stretch;

    & > button {
      flex: 1 1 auto;
    }
  }
`;

const STATUS_MESSAGES: Record<string, string> = {
  updated:
    "Correo de acceso actualizado. Envía ahora un nuevo enlace de acceso al trabajador.",
  already_synchronized:
    "El correo de acceso ya estaba actualizado. Puedes enviar un nuevo enlace de acceso si es necesario.",
  correction_already_in_progress:
    "Ya hay una corrección en curso para este trabajador con un correo distinto. Espera a que se resuelva antes de intentar de nuevo.",
  manual_attention_required: "Revisión manual requerida",
  worker_not_found: "No se encontró el trabajador.",
  worker_not_linked: "Este trabajador no tiene una cuenta vinculada.",
  invalid_profile_role: "Revisión manual requerida",
  linked_auth_user_missing: "Revisión manual requerida",
  invalid_email: "El correo ingresado no es válido.",
  duplicate_worker_email: "Este correo ya está registrado para otro trabajador.",
  email_owned_by_another_auth_user:
    "Este correo ya pertenece a otra cuenta de acceso.",
  multiple_canonical_auth_matches:
    "Este correo coincide con más de una cuenta de acceso; no se puede continuar automáticamente.",
  auth_update_failed: "No se pudo actualizar la cuenta de acceso. Intenta de nuevo.",
  auth_update_uncertain:
    "No se pudo confirmar la actualización de la cuenta de acceso. Intenta de nuevo en unos momentos.",
  worker_sync_failed:
    "El correo del trabajador cambió durante el proceso; intenta de nuevo.",
  worker_sync_uncertain:
    "No se pudo confirmar la sincronización del correo del trabajador. Intenta de nuevo en unos momentos.",
};

function displayMessageFor(result: WorkerAccessEmailCorrectionResult): string {
  return (
    result.message ||
    STATUS_MESSAGES[result.status] ||
    "No se pudo completar la operación."
  );
}

function isSuccessStatus(status: string): boolean {
  return status === "updated" || status === "already_synchronized";
}

interface UpdateWorkerAccessEmailDialogProps {
  isOpen: boolean;
  onRequestClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  workerId: number;
  workerName: string | null;
  workerEmail: string | null;
  isUpdatingAccessEmail: boolean;
  updateAccessEmail: (variables: { workerId: number; newEmail: string }) => void;
  updateAccessEmailResult: WorkerAccessEmailCorrectionResult | undefined;
  resetUpdateAccessEmail: () => void;
}

function UpdateWorkerAccessEmailDialog({
  isOpen,
  onRequestClose,
  triggerRef,
  workerId,
  workerName,
  workerEmail,
  isUpdatingAccessEmail,
  updateAccessEmail,
  updateAccessEmailResult,
  resetUpdateAccessEmail,
}: UpdateWorkerAccessEmailDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const [newEmail, setNewEmail] = useState("");
  const [reveal, setReveal] = useState(false);

  const { context, isLoadingContext } = useWorkerAccessEmailContext(workerId, {
    reveal,
    enabled: isOpen,
  });
  const { resendAccessLink, isResendingAccessLink } =
    useResendWorkerAccessLink();

  useEffect(() => {
    if (isOpen) {
      resetUpdateAccessEmail();
      setNewEmail("");
      setReveal(false);
    }
  }, [isOpen, resetUpdateAccessEmail]);

  // Finding #10: explicit initial focus, for BOTH the native and fallback
  // paths -- never rely on the browser's default "focus the first
  // focusable descendant" behavior for showModal(). Guarded strictly by
  // the isOpen transition (not by isUpdatingAccessEmail/result, which
  // change on every pending/result phase without reopening the dialog),
  // so a later phase change never unexpectedly steals focus back to the
  // email input.
  useEffect(() => {
    const node = dialogRef.current;
    if (supportsNativeDialog) {
      if (!node) return;
      if (isOpen && !node.open) {
        node.showModal();
        emailInputRef.current?.focus();
      } else if (!isOpen && node.open) {
        node.close();
      }
      return;
    }
    if (isOpen) {
      emailInputRef.current?.focus();
    }
  }, [isOpen]);

  // Native <dialog>'s cancel/close events are the single place every
  // native close path (Escape, our own explicit .close() call) funnels
  // through -- refs keep these listeners subscribed once, without
  // re-adding them on every render, while still reading fresh state.
  const isPendingRef = useRef(isUpdatingAccessEmail);
  isPendingRef.current = isUpdatingAccessEmail;
  const onRequestCloseRef = useRef(onRequestClose);
  onRequestCloseRef.current = onRequestClose;

  useEffect(() => {
    const node = dialogRef.current;
    if (!node || !supportsNativeDialog) return;

    function handleCancel(event: Event) {
      // Always routed through the single pending guard, regardless of
      // whether Escape, backdrop click, or the close button triggered it.
      event.preventDefault();
      if (isPendingRef.current) return;
      node!.close();
    }

    function handleClose() {
      onRequestCloseRef.current();
      triggerRef.current?.focus?.();
    }

    node.addEventListener("cancel", handleCancel);
    node.addEventListener("close", handleClose);
    return () => {
      node.removeEventListener("cancel", handleCancel);
      node.removeEventListener("close", handleClose);
    };
  }, [triggerRef]);

  // Escape handling for the non-native fallback only -- the native path
  // gets this for free via the "cancel" event above.
  useEffect(() => {
    if (!isOpen || supportsNativeDialog) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (isUpdatingAccessEmail) return;
      onRequestClose();
      triggerRef.current?.focus?.();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isUpdatingAccessEmail, onRequestClose, triggerRef]);

  function requestClose() {
    if (isUpdatingAccessEmail) return;
    if (supportsNativeDialog) {
      dialogRef.current?.close();
    } else {
      onRequestClose();
      triggerRef.current?.focus?.();
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      requestClose();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    updateAccessEmail({ workerId, newEmail: trimmed });
  }

  if (!isOpen && !supportsNativeDialog) {
    return null;
  }

  const result = updateAccessEmailResult;
  const success = result ? isSuccessStatus(result.status) : false;

  const content = (
    <>
      <Heading id={titleId}>Actualizar correo de acceso</Heading>
      <Description id={descriptionId}>
        Actualiza la cuenta de acceso vinculada a este trabajador. Esta
        acción no envía ningún correo por sí sola.
      </Description>

      <FieldGroup>
        <FieldLabel>Trabajador</FieldLabel>
        <StaticValue>{workerName || "—"}</StaticValue>
      </FieldGroup>

      <FieldGroup>
        <FieldLabel>Correo registrado del trabajador</FieldLabel>
        <StaticValue>{workerEmail?.trim() || "Sin correo registrado"}</StaticValue>
      </FieldGroup>

      <FieldGroup>
        <FieldLabel>Correo de acceso actual</FieldLabel>
        <RevealRow>
          <StaticValue>
            {isLoadingContext
              ? "Cargando…"
              : context?.status === "ok"
              ? context.email
              : "No se pudo cargar"}
          </StaticValue>
          <Button
            type="button"
            variation="secondary"
            size="small"
            onClick={() => setReveal((current) => !current)}
            disabled={isLoadingContext}
          >
            {reveal ? "Ocultar" : "Mostrar"}
          </Button>
        </RevealRow>
      </FieldGroup>

      {result && (
        <StatusBanner $tone={success ? "success" : "error"} role="status">
          {displayMessageFor(result)}
        </StatusBanner>
      )}

      {success ? (
        <Actions>
          <Button
            type="button"
            variation="secondary"
            onClick={() => resendAccessLink({ workerId })}
            disabled={isResendingAccessLink}
          >
            Reenviar enlace de acceso
          </Button>
          <Button type="button" onClick={requestClose}>
            Cerrar
          </Button>
        </Actions>
      ) : (
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <FieldLabel htmlFor="new-access-email">Nuevo correo de acceso</FieldLabel>
            <FullWidthInput
              ref={emailInputRef}
              id="new-access-email"
              type="email"
              required
              placeholder="trabajador@ejemplo.com"
              value={newEmail}
              disabled={isUpdatingAccessEmail}
              onChange={(event) => setNewEmail(event.target.value)}
            />
          </FieldGroup>

          <Warning>
            El correo de acceso (la cuenta con la que el trabajador inicia
            sesión) cambiará. Deberás enviar un nuevo enlace de acceso por
            separado después de confirmar.
          </Warning>

          <Actions>
            <Button
              type="button"
              variation="secondary"
              onClick={requestClose}
              disabled={isUpdatingAccessEmail}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isUpdatingAccessEmail}>
              {isUpdatingAccessEmail ? "Actualizando…" : "Confirmar"}
            </Button>
          </Actions>
        </form>
      )}
    </>
  );

  if (supportsNativeDialog) {
    return (
      <StyledDialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={handleBackdropClick}
      >
        {content}
      </StyledDialog>
    );
  }

  return (
    <FallbackPanel
      role="group"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      {content}
    </FallbackPanel>
  );
}

export default UpdateWorkerAccessEmailDialog;
