import styled from "styled-components";
import { useLocation } from "react-router-dom";
import { HiBars3 } from "react-icons/hi2";
import DarkModeToggle from "./DarkModeToggle";
import AccountPopover from "./AccountPopover";
import DirectLogoutButton from "./DirectLogoutButton";
import { useCurrentIdentity } from "../features/authentication/useCurrentIdentity";
import { resolveRouteContextLabel } from "./routeContext";

const StyledHeader = styled.header`
  background-color: var(--color-grey-0);
  padding: 1.2rem 4.8rem;
  border-bottom: 1px solid var(--color-grey-100);
  display: flex;
  align-items: center;
  gap: 1.6rem;
  grid-column: 1 / -1;

  @media (max-width: 900px) {
    padding: 1.2rem 1.6rem;
    position: sticky;
    top: 0;
    z-index: 12;
  }
`;

// Left region: sidebar toggle (only when the layout supports one), brand,
// optional subtitle. No placeholder element is rendered when the toggle is
// absent (WorkerAppLayout) -- alignment no longer depends on a symmetric
// spacer matching the toggle's width.
const LeftArea = styled.div`
  display: flex;
  align-items: center;
  gap: 1.2rem;
  flex: 0 0 auto;
  min-width: 0;
`;

const MenuButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 4.4rem;
  min-height: 4.4rem;
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-sm);
  background: var(--color-grey-0);
  color: var(--color-grey-700);
  box-shadow: var(--shadow-sm);
  transition: background-color 0.2s ease, color 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background-color: var(--color-grey-100);
    color: var(--color-grey-900);
  }
`;

const BrandGroup = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1.25;
  min-width: 0;
`;

const Logo = styled.span`
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--color-brand-600);
  letter-spacing: 0.05em;
`;

const Subtitle = styled.span`
  font-size: 1.1rem;
  color: var(--color-grey-500);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  /* Narrow desktop/tablet tier: the subtitle is the first thing to give
     ground as available width shrinks. */
  @media (max-width: 1100px) {
    display: none;
  }
`;

// Context region: sits between the brand and the account/theme controls,
// left-aligned right after the brand rather than centered against the full
// header width -- it never depends on the left region's width matching the
// right region's width.
const ContextArea = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
`;

const ContextLabel = styled.span`
  font-size: 1.4rem;
  color: var(--color-grey-500);
  padding-left: 1.6rem;
  margin-left: 0.4rem;
  border-left: 1px solid var(--color-grey-200);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;

  /* Mobile tier: the context label is fully hidden, not just truncated. */
  @media (max-width: 900px) {
    display: none;
  }
`;

const RightArea = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 0 0 auto;
`;

const IdentityPlaceholder = styled.div`
  width: 4.4rem;
  height: 4.4rem;
  border-radius: 50%;
  background-color: var(--color-grey-100);
`;

interface HeaderProps {
  onToggleSidebar?: () => void;
}

function Header({ onToggleSidebar }: HeaderProps) {
  const identity = useCurrentIdentity();
  const { pathname } = useLocation();
  const contextLabel = resolveRouteContextLabel(pathname);

  return (
    <StyledHeader>
      <LeftArea>
        {onToggleSidebar && (
          <MenuButton
            type="button"
            aria-label="Abrir menú"
            onClick={onToggleSidebar}
          >
            <HiBars3 size={22} />
          </MenuButton>
        )}
        <BrandGroup>
          <Logo>ENUB</Logo>
          <Subtitle>Sistema de gestión escolar</Subtitle>
        </BrandGroup>
      </LeftArea>

      <ContextArea>
        <ContextLabel>{contextLabel}</ContextLabel>
      </ContextArea>

      <RightArea>
        <DarkModeToggle />

        {identity.status === "ready" ? (
          <AccountPopover identity={identity} />
        ) : (
          <DirectLogoutButton />
        )}

        {identity.status === "loading" && (
          <IdentityPlaceholder aria-hidden="true" />
        )}
      </RightArea>
    </StyledHeader>
  );
}

export default Header;
