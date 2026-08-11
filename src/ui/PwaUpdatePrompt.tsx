import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import type { PwaRegistrar, PwaUpdateFn } from "../pwa/types";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_REMINDER_DELAY_MS = 30 * 60 * 1000;

const Prompt = styled.aside`
  position: fixed;
  right: 2.4rem;
  bottom: 2.4rem;
  z-index: 1000;
  width: min(42rem, calc(100vw - 3.2rem));
  padding: 1.6rem;
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  background-color: var(--color-grey-0);
  box-shadow: var(--shadow-lg);
  color: var(--color-grey-700);

  @media (max-width: 600px) {
    right: 1.6rem;
    bottom: 1.6rem;
  }
`;

const Title = styled.p`
  margin-bottom: 0.6rem;
  font-size: 1.6rem;
  font-weight: 700;
`;

const Message = styled.p`
  margin-bottom: 1.4rem;
  font-size: 1.4rem;
  line-height: 1.5;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.8rem;
  flex-wrap: wrap;
`;

const ActionButton = styled.button<{ $primary?: boolean }>`
  border: 1px solid
    ${(props) =>
      props.$primary ? "var(--color-brand-600)" : "var(--color-grey-300)"};
  border-radius: var(--border-radius-sm);
  padding: 0.8rem 1.2rem;
  background-color: ${(props) =>
    props.$primary ? "var(--color-brand-600)" : "var(--color-grey-0)"};
  color: ${(props) =>
    props.$primary ? "var(--color-grey-0)" : "var(--color-grey-700)"};
  font-size: 1.4rem;
  font-weight: 600;

  &:hover:not(:disabled) {
    background-color: ${(props) =>
      props.$primary ? "var(--color-brand-700)" : "var(--color-grey-100)"};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

interface PwaUpdatePromptProps {
  registrar: PwaRegistrar;
}

function PwaUpdatePrompt({ registrar }: PwaUpdatePromptProps) {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const updatePwaRef = useRef<PwaUpdateFn | null>(null);
  const checkIntervalRef = useRef<number | null>(null);
  const reminderTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    updatePwaRef.current = registrar({
      onNeedRefresh() {
        setNeedRefresh(true);
        setSnoozed(false);
      },
      onRegistered(registration) {
        if (!registration) return;

        checkIntervalRef.current = window.setInterval(() => {
          void registration.update().catch((error) => {
            console.error("No se pudo comprobar una actualización de la PWA", error);
          });
        }, UPDATE_CHECK_INTERVAL_MS);
      },
      onRegisterError(error) {
        console.error("No se pudo registrar la PWA de ENU", error);
      },
    });

    return () => {
      if (checkIntervalRef.current !== null) {
        window.clearInterval(checkIntervalRef.current);
      }
      if (reminderTimeoutRef.current !== null) {
        window.clearTimeout(reminderTimeoutRef.current);
      }
    };
  }, [registrar]);

  function postponeUpdate() {
    setSnoozed(true);

    if (reminderTimeoutRef.current !== null) {
      window.clearTimeout(reminderTimeoutRef.current);
    }

    reminderTimeoutRef.current = window.setTimeout(() => {
      setSnoozed(false);
    }, UPDATE_REMINDER_DELAY_MS);
  }

  async function applyUpdate() {
    if (!updatePwaRef.current) return;

    setIsUpdating(true);
    try {
      await updatePwaRef.current(true);
    } catch (error) {
      console.error("No se pudo aplicar la actualización de ENU", error);
      setIsUpdating(false);
    }
  }

  if (!needRefresh || snoozed) return null;

  return (
    <Prompt role="status" aria-live="polite" aria-label="Actualización disponible">
      <Title>Nueva versión de ENU disponible</Title>
      <Message>
        Guarda cualquier cambio que estés capturando y actualiza cuando estés listo.
        La página se recargará para aplicar la nueva versión.
      </Message>
      <Actions>
        <ActionButton type="button" onClick={postponeUpdate} disabled={isUpdating}>
          Más tarde
        </ActionButton>
        <ActionButton
          type="button"
          $primary
          onClick={() => void applyUpdate()}
          disabled={isUpdating}
        >
          {isUpdating ? "Actualizando…" : "Actualizar ahora"}
        </ActionButton>
      </Actions>
    </Prompt>
  );
}

export default PwaUpdatePrompt;
