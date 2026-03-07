import styled from "styled-components";
import { HiXMark } from "react-icons/hi2";
import MainNav from "./MainNav";

const StyledSidebar = styled.aside`
  background-color: var(--color-grey-0);
  border-right: 1px solid var(--color-grey-100);
  display: flex;
  flex-direction: column;
  gap: 3.2rem;
  position: relative;
  z-index: 11;
  overflow: hidden;

  width: ${(props) => (props.$isOpen ? "26rem" : "0")};
  padding: ${(props) => (props.$isOpen ? "3.2rem 2.4rem" : "0")};
  opacity: ${(props) => (props.$isOpen ? 1 : 0)};
  pointer-events: ${(props) => (props.$isOpen ? "auto" : "none")};
  transition: width 0.25s ease, padding 0.25s ease, opacity 0.2s ease;

  @media (max-width: 900px) {
    position: fixed;
    inset: 0;
    width: min(80vw, 30rem);
    max-width: 32rem;
    padding: 2.8rem 2.4rem 3.2rem;
    border-right: none;
    box-shadow: var(--shadow-lg);
    opacity: 1;
    overflow: auto;
    transform: translateX(${(props) => (props.$isOpen ? "0" : "-100%")});
    pointer-events: ${(props) => (props.$isOpen ? "auto" : "none")};
    transition: transform 0.25s ease;
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

function Sidebar({ isOpen, onClose, onNavigate }) {
  return (
    <StyledSidebar $isOpen={isOpen}>
      <CloseButton aria-label="Cerrar menú" onClick={onClose}>
        <HiXMark size={22} />
      </CloseButton>
      <MainNav onNavigate={onNavigate} />
    </StyledSidebar>
  );
}

export default Sidebar;
