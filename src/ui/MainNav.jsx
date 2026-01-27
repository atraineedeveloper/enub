import { NavLink } from "react-router-dom";
import styled from "styled-components";
import { HiAcademicCap, HiBookOpen, HiOutlineUsers } from "react-icons/hi2";
import { useState } from "react";
import { IoIosArrowDropdownCircle, IoIosArrowDropright } from "react-icons/io";
import { FaCalendar, FaTable } from "react-icons/fa";
import { MdLibraryBooks } from "react-icons/md";
import { FaPerson, FaUserGear } from "react-icons/fa6";
import { RiGovernmentFill } from "react-icons/ri";

const NavList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const NavLinkHeader = styled.h2`
  display: flex;
  align-items: center;
  gap: 1.2rem;

  color: var(--color-grey-800);
  font-size: 1.8rem;
  font-weight: 600;
  padding: 1.2rem 2.4rem;
  transition: all 0.3s;

  &:hover,
  &:active,
  &.active:link,
  &.active:visited {
    cursor: pointer;
    color: var(--color-grey-800);
    background-color: var(--color-grey-50);
    border-radius: var(--border-radius-sm);
  }
`;

const StyledNavLink = styled(NavLink)`
  &:link,
  &:visited {
    display: flex;
    align-items: center;
    gap: 1.2rem;

    color: var(--color-grey-600);
    font-size: 1.6rem;
    font-weight: 600;
    padding: 1.2rem 2.4rem;
    transition: all 0.3s;
  }

  /* This works because react-router places the active class on the active NavLink */
  &:hover,
  &:active,
  &.active:link,
  &.active:visited {
    color: var(--color-grey-800);
    background-color: var(--color-grey-50);
    border-radius: var(--border-radius-sm);
  }

  & svg {
    width: 2.4rem;
    height: 2.4rem;
    color: var(--color-grey-400);
    transition: all 0.3s;
  }

  &:hover svg,
  &:active svg,
  &.active:link svg,
  &.active:visited svg {
    color: var(--color-brand-600);
  }
`;

function MainNav({ onNavigate = () => {} }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <nav>
      <NavLinkHeader onClick={() => setIsOpen(!isOpen)}>
        <span>Administrar registros</span>
        {isOpen ? (
          <IoIosArrowDropdownCircle size={48} />
        ) : (
          <IoIosArrowDropright size={48} />
        )}
      </NavLinkHeader>
      {isOpen && (
        <NavList>
          <li>
            <StyledNavLink to="/degrees" onClick={onNavigate}>
              <HiAcademicCap />
              <span>Licenciaturas</span>
            </StyledNavLink>
          </li>
          <li>
            <StyledNavLink to="/workers" onClick={onNavigate}>
              <FaPerson />
              <span>Trabajadores</span>
            </StyledNavLink>
          </li>
          <li>
            <StyledNavLink to="/subjects" onClick={onNavigate}>
              <HiBookOpen />
              <span>Asignaturas</span>
            </StyledNavLink>
          </li>
          <li>
            <StyledNavLink to="/groups" onClick={onNavigate}>
              <HiOutlineUsers />
              <span>Grupos Escolares</span>
            </StyledNavLink>
          </li>
          <li>
            <StyledNavLink to="/study-programs" onClick={onNavigate}>
              <MdLibraryBooks />
              <span>Programas de estudio</span>
            </StyledNavLink>
          </li>
          <li>
            <StyledNavLink to="/roles" onClick={onNavigate}>
              <FaUserGear />
              <span>Roles</span>
            </StyledNavLink>
          </li>
          <li>
            <StyledNavLink to="/state-roles" onClick={onNavigate}>
              <RiGovernmentFill />
              <span>Roles Estatales</span>
            </StyledNavLink>
          </li>
          <li>
            <StyledNavLink to="/others" onClick={onNavigate}>
              <FaTable />
              <span>Otros datos</span>
            </StyledNavLink>
          </li>
        </NavList>
      )}
      <NavLink to="/semesters" onClick={onNavigate}>
        <NavLinkHeader>
          <span>Administrar horarios</span>
          <FaCalendar size={26} />
        </NavLinkHeader>
      </NavLink>
    </nav>
  );
}

export default MainNav;
