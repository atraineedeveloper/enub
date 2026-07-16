import styled from "styled-components";
import { HiArrowRightOnRectangle } from "react-icons/hi2";
import SpinnerMini from "./SpinnerMini";
import { useLogout } from "../features/authentication/useLogout";

const StyledButton = styled.button`
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

  &:hover {
    background-color: var(--color-grey-100);
    color: var(--color-grey-900);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Shown whenever identity is not `ready` (loading, incomplete, denied,
// profile-error, worker-error) in place of the account popover trigger.
// Uses the same useLogout() hook as AccountPopover's logout action -- no
// second logout implementation.
function DirectLogoutButton() {
  const { logout, isLoading } = useLogout();

  return (
    <StyledButton
      type="button"
      aria-label="Cerrar sesión"
      disabled={isLoading}
      onClick={() => logout()}
    >
      {isLoading ? <SpinnerMini /> : <HiArrowRightOnRectangle size={22} />}
    </StyledButton>
  );
}

export default DirectLogoutButton;
