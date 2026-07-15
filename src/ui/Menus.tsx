import {
  createContext,
  forwardRef,
  useContext,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { HiEllipsisVertical } from "react-icons/hi2";
import styled from "styled-components";
import { useOutsideClick } from "../hooks/useOutsideClick";

const Menu = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const StyledToggle = styled.button`
  background: none;
  border: none;
  padding: 0.4rem;
  border-radius: var(--border-radius-sm);
  transform: translateX(0.8rem);
  transition: all 0.2s;

  &:hover {
    background-color: var(--color-grey-100);
  }

  & svg {
    width: 2.4rem;
    height: 2.4rem;
    color: var(--color-grey-700);
  }
`;

interface Position {
  x: number;
  y: number;
}

const StyledList = styled.ul<{ position: Position }>`
  position: fixed;

  background-color: var(--color-grey-0);
  box-shadow: var(--shadow-md);
  border-radius: var(--border-radius-md);

  right: ${(props) => props.position.x}px;
  top: ${(props) => props.position.y}px;
`;

const StyledButton = styled.button`
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 1.2rem 2.4rem;
  font-size: 1.4rem;
  transition: all 0.2s;

  display: flex;
  align-items: center;
  gap: 1.6rem;

  &:hover {
    background-color: var(--color-grey-50);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  & svg {
    width: 1.6rem;
    height: 1.6rem;
    color: var(--color-grey-400);
    transition: all 0.3s;
  }
`;

type MenuId = string | number;

interface MenusContextValue {
  openId: MenuId;
  close: () => void;
  open: (id: MenuId) => void;
  position: Position | null;
  setPosition: (position: Position | null) => void;
}

const MenusContext = createContext<MenusContextValue | undefined>(undefined);

interface MenusProps {
  children: ReactNode;
}

function Menus({ children }: MenusProps) {
  const [openId, setOpenId] = useState<MenuId>("");
  const [position, setPosition] = useState<Position | null>(null);

  const close = () => setOpenId("");
  const open = setOpenId;

  return (
    <MenusContext.Provider
      value={{ openId, close, open, position, setPosition }}
    >
      {children}
    </MenusContext.Provider>
  );
}

interface ToggleProps {
  id: MenuId;
}

// Forwards a ref to the underlying DOM button -- this is the one
// always-mounted element per row (unlike the portaled dropdown list,
// which unmounts on close), so callers that need to restore focus after
// closing something this toggle opened (e.g. a dedicated dialog, not the
// dropdown itself) have a stable, still-mounted target to focus.
const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { id },
  ref,
) {
  const { openId, close, open, setPosition } = useContext(MenusContext)!;

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    const target = e.target as HTMLElement;
    const rect = target.closest("button")!.getBoundingClientRect();
    setPosition({
      x: window.innerWidth - rect.width - rect.x,
      y: rect.y + rect.height + 8,
    });

    openId === "" || openId !== id ? open(id) : close();
  }

  return (
    <StyledToggle ref={ref} onClick={handleClick}>
      <HiEllipsisVertical />
    </StyledToggle>
  );
});

interface ListProps {
  id: MenuId;
  children: ReactNode;
}

function List({ id, children }: ListProps) {
  const { openId, position, close } = useContext(MenusContext)!;
  // useOutsideClick.js is untyped (out of scope for this change); its `ref`
  // infers as MutableRefObject<undefined> from a bare useRef(). This cast
  // describes its real runtime contract (a DOM ref) without converting it.
  const ref = useOutsideClick(close) as unknown as RefObject<HTMLUListElement>;

  if (openId !== id) return null;

  return createPortal(
    <StyledList position={position!} ref={ref}>
      {children}
    </StyledList>,
    document.body
  );
}

interface ButtonProps {
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

function Button({ children, icon, onClick, disabled }: ButtonProps) {
  const { close } = useContext(MenusContext)!;

  function handleClick() {
    if (disabled) return;
    onClick?.();
    close();
  }

  return (
    <li>
      <StyledButton onClick={handleClick} disabled={disabled}>
        {icon}
        <span>{children}</span>
      </StyledButton>
    </li>
  );
}

Menus.Menu = Menu;
Menus.Toggle = Toggle;
Menus.List = List;
Menus.Button = Button;

export default Menus;
