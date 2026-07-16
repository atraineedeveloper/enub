import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useLocation } from "react-router-dom";
import { HiChevronDown } from "react-icons/hi2";
import Avatar from "./Avatar";
import SpinnerMini from "./SpinnerMini";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { useLogout } from "../features/authentication/useLogout";
import type { IdentityReady } from "../features/authentication/useCurrentIdentity";

const Wrapper = styled.div`
  position: relative;
`;

const Trigger = styled.button`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-height: 4.4rem;
  min-width: 4.4rem;
  padding: 0.4rem 0.8rem;
  border: 1px solid transparent;
  border-radius: var(--border-radius-sm);
  background: none;
  color: var(--color-grey-700);
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--color-grey-100);
  }
`;

const NameRoleGroup = styled.span`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  /* The trigger button also contains an icon (the chevron), which
     triggers the global "button:has(svg) { line-height: 0; }" rule
     (GlobalStyles.ts) -- that collapses this text's line box to zero
     height since line-height inherits. Reset it explicitly here. */
  line-height: 1.3;

  @media (max-width: 900px) {
    display: none;
  }
`;

const Name = styled.span`
  max-width: 16rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--color-grey-800);
`;

const RoleLabel = styled.span`
  font-size: 1.2rem;
  color: var(--color-grey-500);
`;

const Chevron = styled(HiChevronDown)`
  flex-shrink: 0;

  @media (max-width: 900px) {
    display: none;
  }
`;

const Popover = styled.div`
  position: absolute;
  top: calc(100% + 0.8rem);
  right: 0;
  min-width: 22rem;
  max-width: calc(100vw - 3.2rem);
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-100);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-md);
  padding: 1.2rem;
  z-index: 20;
`;

const PopoverHeading = styled.div`
  padding: 0.4rem 0.8rem 1.2rem;
  border-bottom: 1px solid var(--color-grey-100);
  margin-bottom: 0.8rem;
`;

const PopoverName = styled.p`
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--color-grey-800);
  overflow-wrap: break-word;
`;

const PopoverRole = styled.p`
  font-size: 1.2rem;
  color: var(--color-grey-500);
`;

const LogoutButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  min-height: 4.4rem;
  padding: 0.8rem;
  border: none;
  border-radius: var(--border-radius-sm);
  background: none;
  text-align: left;
  font-size: 1.4rem;
  line-height: 1.3;
  color: var(--color-grey-700);
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--color-grey-50);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const POPOVER_ID = "account-popover";

interface AccountPopoverProps {
  identity: IdentityReady;
}

function AccountPopover({ identity }: AccountPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { pathname } = useLocation();
  const { logout, isLoading: isLoggingOut } = useLogout();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => setIsOpen(false);
  // Outside click closes via this hook without touching focus at all.
  const wrapperRef = useOutsideClick<HTMLDivElement>(close);

  // Route navigation closes the popover but intentionally does not return
  // focus to the old trigger -- the route (and often the page content) has
  // changed, so restoring focus there would not be meaningful.
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Only this keyboard-dismissal path returns focus to the trigger.
  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <Wrapper ref={wrapperRef}>
      <Trigger
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={POPOVER_ID}
        aria-label={`Abrir opciones de cuenta de ${identity.displayName}`}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Avatar src={identity.avatarUrl} name={identity.displayName} decorative />
        <NameRoleGroup>
          <Name title={identity.displayName}>{identity.displayName}</Name>
          <RoleLabel>{identity.roleLabel}</RoleLabel>
        </NameRoleGroup>
        <Chevron aria-hidden="true" />
      </Trigger>

      {isOpen && (
        <Popover id={POPOVER_ID} role="region" aria-label="Cuenta">
          <PopoverHeading>
            <PopoverName>{identity.displayName}</PopoverName>
            <PopoverRole>{identity.roleLabel}</PopoverRole>
          </PopoverHeading>
          <LogoutButton type="button" disabled={isLoggingOut} onClick={() => logout()}>
            {isLoggingOut ? <SpinnerMini /> : null}
            <span>Cerrar sesión</span>
          </LogoutButton>
        </Popover>
      )}
    </Wrapper>
  );
}

export default AccountPopover;
