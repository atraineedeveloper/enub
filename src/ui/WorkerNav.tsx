import styled from "styled-components";
import { NavLink } from "react-router-dom";
import {
  HiOutlineCalendarDays,
  HiOutlineDocumentText,
  HiOutlineUserCircle,
} from "react-icons/hi2";
import { WORKER_NAV_ITEMS } from "./workerNavConfig";

const ICONS: Record<string, typeof HiOutlineDocumentText> = {
  "/my-documents": HiOutlineDocumentText,
  "/my-schedule": HiOutlineCalendarDays,
  "/my-profile": HiOutlineUserCircle,
};

// A separate row beneath the shared Header -- never overlaps or competes
// with the header's account popover/theme toggle, which remain in the
// header itself. Horizontally scrollable within its own container (never
// the page) if it doesn't fit a narrow viewport, so all three entries stay
// reachable rather than wrapping or clipping.
const NavBar = styled.nav`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.8rem 4.8rem;
  background-color: var(--color-grey-0);
  border-bottom: 1px solid var(--color-grey-100);
  overflow-x: auto;

  @media (max-width: 900px) {
    padding: 0.8rem 1.6rem;
    gap: 0.2rem;
  }
`;

const NavItem = styled(NavLink)`
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  min-height: 4.4rem;
  padding: 0.8rem 1.6rem;
  border-radius: var(--border-radius-sm);
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--color-grey-600);
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;

  &:hover {
    background-color: var(--color-grey-50);
    color: var(--color-grey-800);
  }

  /* Non-color active indication: bold weight + underline, not color alone
     -- react-router already sets aria-current="page" on the active link. */
  &.active {
    color: var(--color-brand-700);
    border-bottom-color: var(--color-brand-600);
    font-weight: 700;
  }

  & svg {
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
  }
`;

function WorkerNav() {
  return (
    <NavBar aria-label="Navegación de la cuenta del trabajador">
      {WORKER_NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.to];
        return (
          <NavItem key={item.to} to={item.to} end>
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </NavItem>
        );
      })}
    </NavBar>
  );
}

export default WorkerNav;
