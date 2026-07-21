import {
  cloneElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { HiXMark } from "react-icons/hi2";
import styled from "styled-components";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { ModalContext } from "./ModalContext";
import { useModal } from "./useModal";

const StyledModal = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: var(--color-grey-0);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 3.2rem 4rem;
  transition: all 0.5s;
  overflow: auto;
  max-height: 500px;
  outline: none;
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background-color: var(--backdrop-color);
  backdrop-filter: blur(4px);
  z-index: 1000;
  transition: all 0.5s;
`;

const Button = styled.button`
  background: none;
  border: none;
  padding: 0.4rem;
  border-radius: var(--border-radius-sm);
  transform: translateX(0.8rem);
  transition: all 0.2s;
  position: absolute;
  top: 1.2rem;
  right: 1.9rem;

  &:hover {
    background-color: var(--color-grey-100);
  }

  & svg {
    width: 2.4rem;
    height: 2.4rem;
    /* Sometimes we need both */
    /* fill: var(--color-grey-500);
    stroke: var(--color-grey-500); */
    color: var(--color-grey-500);
  }
`;

// Visually hidden but still reachable by assistive tech -- used only when
// a Modal.Window is given an explicit `title` and its content doesn't
// already provide a visible heading suitable for aria-labelledby (the
// standard clip technique, not display:none, which would remove it from
// the accessibility tree too).
const VisuallyHiddenTitle = styled.h2`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

interface ModalProps {
  children: ReactNode;
}

function Modal({ children }: ModalProps) {
  const [openName, setOpenName] = useState("");

  const close = () => setOpenName("");
  const open = setOpenName;

  return (
    <ModalContext.Provider value={{ openName, close, open }}>
      {children}
    </ModalContext.Provider>
  );
}

interface OpenProps {
  children: ReactElement<{ onClick?: () => void }>;
  opens: string;
}

function Open({ children, opens: opensWindowName }: OpenProps) {
  const { open } = useModal();

  return cloneElement(children, { onClick: () => open(opensWindowName) });
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface WindowProps {
  children: ReactElement<{ onCloseModal?: () => void }>;
  name: string;
  // Optional accessible title. When provided, it becomes this window's
  // aria-labelledby target (rendered visually hidden, since the window's
  // own content -- e.g. ConfirmDelete's own <Heading> -- usually already
  // shows a visible title of its own; duplicating it visibly would be
  // redundant). When omitted (every pre-existing consumer, unchanged),
  // the window still gets a valid accessible name via aria-label={name},
  // so "no consumer update required" never means "no accessible name at
  // all".
  title?: string;
}

function Window({ children, name, title }: WindowProps) {
  const { openName, close } = useModal();
  const isOpen = name === openName;
  const titleId = `modal-window-title-${name}`;
  // useOutsideClick.js is untyped (out of scope for this change); its `ref`
  // infers as MutableRefObject<undefined> from a bare useRef(). This cast
  // describes its real runtime contract (a DOM ref) without converting it.
  // The same ref doubles as this window's focus-trap/initial-focus
  // container -- one DOM node, one ref, both concerns.
  const dialogRef = useOutsideClick(close) as unknown as RefObject<HTMLDivElement>;
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Initial focus, a focus trap (Tab/Shift+Tab never leave this window),
  // Escape-to-close, and restoring focus to whatever had it before this
  // window opened -- only if that element is still attached to the DOM
  // (isConnected). If it isn't (e.g. the row that opened this window was
  // itself removed while the window was open), calling .focus() on a
  // detached node is a silent no-op in some browsers and throws in
  // others; the guard avoids both. Escape closing "only the topmost
  // modal" falls out of this architecture by construction: only one
  // Modal.Window can ever be open at a time (a single `openName` string
  // in the shared context), so there is never a second Modal.Window
  // beneath this one to accidentally also close. A separate, non-Modal
  // overlay hosting this window (e.g. a detail drawer) is expected to
  // check `openName` itself before reacting to its own Escape handler --
  // see DocumentDetailDrawer.tsx for that side of the contract.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const container = dialogRef.current;
    const focusable = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? container)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        return;
      }

      if (event.key !== "Tab") return;

      const current = dialogRef.current;
      const focusableEls = Array.from(
        current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
      );
      if (!focusableEls.length) {
        event.preventDefault();
        return;
      }

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      const toRestore = previouslyFocusedElementRef.current;
      if (toRestore?.isConnected) {
        toRestore.focus();
      }
    };
  }, [isOpen, close, dialogRef]);

  if (!isOpen) return null;

  return createPortal(
    <Overlay>
      <StyledModal
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : name}
        tabIndex={-1}
      >
        <Button type="button" onClick={close} aria-label="Cerrar">
          <HiXMark />
        </Button>

        {title && <VisuallyHiddenTitle id={titleId}>{title}</VisuallyHiddenTitle>}

        <div>{cloneElement(children, { onCloseModal: close })}</div>
      </StyledModal>
    </Overlay>,
    document.body
  );
}

Modal.Open = Open;
Modal.Window = Window;

export default Modal;
