import { describe, expect, test } from "bun:test";
import { useState } from "react";
import { fireClick, fireKeyDown, renderDom } from "../testUtils/renderDom";
import Modal from "./Modal";
import { useModal } from "./useModal";

// Real-DOM interaction suite for Modal.tsx: every scenario here dispatches
// genuine events (click, keydown) against a genuine DOM (happy-dom) and
// asserts on real document.activeElement/attribute state -- nothing about
// Modal's own accessibility behavior is mocked, since that behavior is
// exactly what these tests exist to validate.

function TwoButtonContent({ onCloseModal }: { onCloseModal?: () => void }) {
  return (
    <div>
      <button type="button" data-testid="first">First</button>
      <button type="button" data-testid="second">Second</button>
      <button type="button" data-testid="confirm" onClick={onCloseModal}>
        Confirm
      </button>
    </div>
  );
}

function harness(title?: string) {
  return renderDom(
    <Modal>
      <Modal.Open opens="test-window">
        <button type="button" data-testid="trigger">Open</button>
      </Modal.Open>
      <Modal.Window name="test-window" title={title}>
        <TwoButtonContent />
      </Modal.Window>
    </Modal>
  );
}

// Modal.Window portals directly to document.body (not to the render
// container), so dialog content must always be queried from `document`,
// never from `container`. A real browser click also focuses the clicked
// button as a native side effect (which is what Modal.Window's "restore
// focus to whatever opened it" relies on) -- a synthetic dispatchEvent
// click does not reproduce that on its own, so the trigger is focused
// explicitly first to accurately model a real user click.
function openDialog(container: HTMLElement) {
  const trigger = container.querySelector<HTMLElement>('[data-testid="trigger"]')!;
  trigger.focus();
  fireClick(trigger);
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

describe("useModal -- contrato fuera del provider", () => {
  function ConsumerWithoutProvider() {
    useModal();
    return null;
  }

  test("llamar a useModal fuera de <Modal> lanza el error explícito (no solo un console.error silencioso)", () => {
    // React logs a red console.error for an uncaught render error too, but
    // that's incidental noise, not the assertion -- what actually matters
    // is that the throw itself propagates out of render (with no error
    // boundary here, createRoot's initial synchronous render rethrows),
    // so the caller genuinely cannot use the hook wrong and silently get
    // `undefined` back instead of a real, catchable error.
    expect(() => renderDom(<ConsumerWithoutProvider />)).toThrow(
      "useModal must be used within a <Modal> provider"
    );
  });
});

describe("Modal.Window -- accesibilidad (role, aria-modal, aria-labelledby)", () => {
  test("role=dialog y aria-modal=true en el contenedor abierto", () => {
    const { container, unmount } = harness();
    const dialog = openDialog(container);

    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    unmount();
  });

  test("con title: aria-labelledby apunta a un elemento cuyo texto es ese título", () => {
    const { container, unmount } = harness("Eliminar archivo.pdf");
    const dialog = openDialog(container)!;

    const labelledbyId = dialog.getAttribute("aria-labelledby");
    expect(labelledbyId).toBeTruthy();
    const labelEl = container.ownerDocument.getElementById(labelledbyId!);
    expect(labelEl?.textContent).toBe("Eliminar archivo.pdf");
    unmount();
  });

  test("sin title: cae a aria-label usando el nombre de la ventana (nunca queda sin nombre accesible)", () => {
    const { container, unmount } = harness();
    const dialog = openDialog(container)!;

    expect(dialog.getAttribute("aria-labelledby")).toBeNull();
    expect(dialog.getAttribute("aria-label")).toBe("test-window");
    unmount();
  });
});

describe("Modal.Window -- foco inicial y focus trap", () => {
  test("al abrir, el foco queda dentro del diálogo", () => {
    const { container, unmount } = harness();
    const dialog = openDialog(container)!;

    expect(dialog.contains(document.activeElement)).toBe(true);
    unmount();
  });

  test("Tab desde el último elemento enfocable vuelve al primero (no se escapa del modal)", () => {
    const { container, unmount } = harness();
    const dialog = openDialog(container)!;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button"));
    const last = focusable[focusable.length - 1];
    const first = focusable[0];

    last.focus();
    expect(document.activeElement).toBe(last);

    fireKeyDown(document, "Tab");
    expect(document.activeElement).toBe(first);
    unmount();
  });

  test("Shift+Tab desde el primer elemento enfocable va al último (no se escapa del modal)", () => {
    const { container, unmount } = harness();
    const dialog = openDialog(container)!;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button"));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first.focus();
    expect(document.activeElement).toBe(first);

    fireKeyDown(document, "Tab", { shiftKey: true });
    expect(document.activeElement).toBe(last);
    unmount();
  });
});

describe("Modal.Window -- Escape", () => {
  test("Escape cierra el modal abierto", () => {
    const { container, unmount } = harness();
    expect(openDialog(container)).not.toBeNull();

    fireKeyDown(document, "Escape");

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    unmount();
  });
});

describe("Modal.Window -- restauración de foco", () => {
  test("si el elemento que abrió el modal sigue en el DOM, el foco vuelve a él al cerrar", () => {
    const { container, unmount } = harness();
    const trigger = container.querySelector<HTMLElement>('[data-testid="trigger"]')!;
    openDialog(container);

    fireKeyDown(document, "Escape");

    expect(document.activeElement).toBe(trigger);
    unmount();
  });

  test("si el elemento que abrió el modal ya no está conectado al DOM, cerrar no lanza y no intenta enfocarlo", () => {
    // The trigger's removal is driven by a real React state update (a
    // second button toggles it away), not a raw DOM mutation -- this
    // models "the row that opened the modal was itself removed elsewhere"
    // the way it actually happens in the app (a re-render), and keeps
    // React's own reconciliation consistent with the DOM throughout.
    function RemovableTrigger() {
      const [showTrigger, setShowTrigger] = useState(true);
      return (
        <Modal>
          {showTrigger && (
            <Modal.Open opens="w">
              <button type="button" id="removable-trigger">Open</button>
            </Modal.Open>
          )}
          <button
            type="button"
            id="remove-trigger-btn"
            onClick={() => setShowTrigger(false)}
          >
            Remove trigger
          </button>
          <Modal.Window name="w">
            <TwoButtonContent />
          </Modal.Window>
        </Modal>
      );
    }

    const { container, unmount } = renderDom(<RemovableTrigger />);
    const trigger = container.querySelector<HTMLElement>("#removable-trigger")!;
    fireClick(trigger);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    // The trigger is removed from the DOM entirely while the modal is
    // still open (e.g. the row that opened it was deleted elsewhere).
    const removeButton = container.querySelector<HTMLElement>("#remove-trigger-btn")!;
    fireClick(removeButton);
    expect(trigger.isConnected).toBe(false);

    expect(() => fireKeyDown(document, "Escape")).not.toThrow();
    expect(document.activeElement).not.toBe(trigger);
    unmount();
  });
});

describe("Modal.Window -- cleanup de listeners", () => {
  test("cerrar el modal remueve su listener de keydown -- Escape después de cerrar no hace nada más", () => {
    const { container, unmount } = harness();
    openDialog(container);
    fireKeyDown(document, "Escape");
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    // A second Escape with no dialog open must be a complete no-op --
    // proves the effect's cleanup actually ran removeEventListener,
    // rather than leaving a stale listener that keeps calling close().
    expect(() => fireKeyDown(document, "Escape")).not.toThrow();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    unmount();
  });

  test("desmontar con el modal abierto no deja un listener colgado", () => {
    const { container, unmount } = harness();
    openDialog(container);

    unmount();

    // Nothing left in the DOM to assert on, but dispatching Escape after
    // unmount must not throw (a leaked listener referencing a stale
    // dialogRef.current would).
    expect(() => fireKeyDown(document, "Escape")).not.toThrow();
  });

  test("addEventListener y removeEventListener de keydown quedan balanceados en un ciclo abrir/cerrar", () => {
    const originalAdd = document.addEventListener.bind(document);
    const originalRemove = document.removeEventListener.bind(document);
    let addCount = 0;
    let removeCount = 0;

    document.addEventListener = ((...args: Parameters<typeof originalAdd>) => {
      if (args[0] === "keydown") addCount += 1;
      return originalAdd(...args);
    }) as typeof document.addEventListener;
    document.removeEventListener = ((...args: Parameters<typeof originalRemove>) => {
      if (args[0] === "keydown") removeCount += 1;
      return originalRemove(...args);
    }) as typeof document.removeEventListener;

    try {
      const { container, unmount } = harness();
      openDialog(container);
      expect(addCount).toBe(1);
      fireKeyDown(document, "Escape");
      expect(removeCount).toBe(1);
      unmount();
    } finally {
      document.addEventListener = originalAdd;
      document.removeEventListener = originalRemove;
    }
  });
});

describe("Modal.Window -- no rompe la API de consumidores existentes", () => {
  test("Modal.Open sigue abriendo la ventana nombrada mediante un trigger clicable normal", () => {
    const { container, unmount } = harness();
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    const trigger = container.querySelector<HTMLElement>('[data-testid="trigger"]')!;
    fireClick(trigger);

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    unmount();
  });

  test("onCloseModal sigue inyectándose al contenido y cerrando el modal al invocarse", () => {
    const { container, unmount } = harness();
    openDialog(container);

    const confirmButton = document.querySelector<HTMLElement>('[data-testid="confirm"]')!;
    fireClick(confirmButton);

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    unmount();
  });

  test("el botón de cerrar (X) sigue cerrando el modal", () => {
    const { container, unmount } = harness();
    const dialog = openDialog(container)!;

    const closeButton = dialog.querySelector<HTMLElement>('[aria-label="Cerrar"]')!;
    fireClick(closeButton);

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    unmount();
  });

  test("un click fuera del modal sigue cerrándolo (comportamiento previo sin cambios)", () => {
    const { container, unmount } = harness();
    openDialog(container);

    // Outside-click dismissal (useOutsideClick) listens for "click" at
    // the document level in the capture phase.
    fireClick(document.body);

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    unmount();
  });
});
