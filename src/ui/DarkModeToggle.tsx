import { HiOutlineMoon, HiOutlineSun } from "react-icons/hi2";
import styled from "styled-components";
import { useDarkMode } from "../context/useDarkMode";

const ButtonIcon = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 4.4rem;
  min-height: 4.4rem;
  background: none;
  border: none;
  border-radius: var(--border-radius-sm);
  transition: all 0.2s;

  &:hover {
    background-color: var(--color-grey-100);
  }

  & svg {
    width: 2.2rem;
    height: 2.2rem;
    color: var(--color-brand-600);
  }
`;

function DarkModeToggle() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <ButtonIcon
      type="button"
      aria-label={isDarkMode ? "Activar modo claro" : "Activar modo oscuro"}
      onClick={toggleDarkMode}
    >
      {isDarkMode ? <HiOutlineSun /> : <HiOutlineMoon />}
    </ButtonIcon>
  );
}

export default DarkModeToggle;
