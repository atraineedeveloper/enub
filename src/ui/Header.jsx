import styled from "styled-components";
import Logout from "../features/authentication/Logout";
import { HiBars3 } from "react-icons/hi2";

const StyledHeader = styled.header`
  background-color: var(--color-grey-0);
  padding: 1.2rem 4.8rem;
  border-bottom: 1px solid var(--color-grey-100);
  display: flex;
  align-items: center;
  justify-content: space-between;

  @media (max-width: 900px) {
    padding: 1.2rem 1.6rem;
    position: sticky;
    top: 0;
    z-index: 12;
  }
`;

const MenuButton = styled.button`
  display: none;
  align-items: center;
  justify-content: center;
  width: 3.6rem;
  height: 3.6rem;
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-sm);
  background: var(--color-grey-0);
  color: var(--color-grey-700);
  box-shadow: var(--shadow-sm);

  @media (max-width: 900px) {
    display: inline-flex;
  }
`;

function Header({ onToggleSidebar }) {
  return (
    <StyledHeader>
      <MenuButton aria-label="Abrir menú" onClick={onToggleSidebar}>
        <HiBars3 size={22} />
      </MenuButton>
      <Logout />
    </StyledHeader>
  );
}

export default Header;
