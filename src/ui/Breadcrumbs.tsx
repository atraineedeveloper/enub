import { Fragment } from "react";
import { NavLink } from "react-router-dom";
import styled from "styled-components";
import { HiOutlineChevronRight } from "react-icons/hi2";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

const CrumbNav = styled.nav`
  padding: 0.4rem 0;
  margin-bottom: 1.6rem;
`;

const CrumbList = styled.ol`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
`;

const CrumbLink = styled(NavLink)`
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.2rem;
  font-weight: 600;
  color: var(--color-grey-700);

  &:hover,
  &.active:link,
  &.active:visited {
    color: var(--color-brand-700);
  }
`;

const CrumbCurrent = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.2rem;
  font-weight: 700;
  color: var(--color-brand-700);
`;

const Separator = styled.span`
  display: inline-flex;
  align-items: center;
  color: var(--color-grey-400);
  margin-inline: 0.2rem;
`;

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

function Breadcrumbs({ items = [] }: BreadcrumbsProps) {
  if (!items.length) return null;

  return (
    <CrumbNav aria-label="Ruta de navegación">
      <CrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <Fragment key={`${item.label}-${index}`}>
              {item.to && !isLast ? (
                <CrumbLink to={item.to}>{item.label}</CrumbLink>
              ) : (
                <CrumbCurrent aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </CrumbCurrent>
              )}
              {!isLast && (
                <Separator aria-hidden="true">
                  <HiOutlineChevronRight size={16} />
                </Separator>
              )}
            </Fragment>
          );
        })}
      </CrumbList>
    </CrumbNav>
  );
}

export default Breadcrumbs;
