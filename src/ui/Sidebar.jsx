import styled from "styled-components";
import { HiXMark } from "react-icons/hi2";
import MainNav from "./MainNav";

const StyledSidebar = styled.aside`
  background-color: var(--color-grey-0);
  padding: 3.2rem 2.4rem;
  border-right: 1px solid var(--color-grey-100);

  grid-row: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 3.2rem;

  @media (max-width: 900px) {
    position: fixed;
    inset: 0;
    width: min(80vw, 30rem);
    max-width: 32rem;
    border-right: none;
    box-shadow: var(--shadow-lg);
    transform: translateX(${(props) => (props.$isOpen ? "0" : "-100%")});
    transition: transform 0.2s ease;
    z-index: 11;
    padding: 2.8rem 2.4rem 3.2rem;
    background: var(--color-grey-0);
  }
`;

const CloseButton = styled.button`
  display: none;
  align-self: flex-end;
  width: 3.2rem;
  height: 3.2rem;
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-sm);
  background: var(--color-grey-0);
  color: var(--color-grey-700);
  box-shadow: var(--shadow-sm);

  @media (max-width: 900px) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
`;

function Sidebar({ isOpen, onClose }) {
  return (
    <StyledSidebar $isOpen={isOpen}>
      <CloseButton aria-label="Cerrar menú" onClick={onClose}>
        <HiXMark size={22} />
      </CloseButton>
      <MainNav onNavigate={onClose} />
    </StyledSidebar>
  );
}

export default Sidebar;
