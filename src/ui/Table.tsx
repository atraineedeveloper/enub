import { createContext, useContext, type ReactNode } from "react";
import styled from "styled-components";

const StyledTable = styled.div`
  border: 1px solid var(--color-grey-200);
  font-size: 1.4rem;
  background-color: var(--color-grey-0);
  border-radius: 7px;
  overflow: hidden;
  width: 100%;
  display: block;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
`;

const CommonRow = styled.div<{ columns: string }>`
  display: grid;
  grid-template-columns: ${(props) => props.columns};
  column-gap: 2.4rem;
  align-items: center;
  transition: none;
  min-width: 68rem;

  @media (max-width: 900px) {
    min-width: 58rem;
    column-gap: 1.6rem;
  }
`;

const StyledHeader = styled(CommonRow)`
  padding: 1.6rem 2.4rem;

  background-color: var(--color-grey-50);
  border-bottom: 1px solid var(--color-grey-100);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-weight: 600;
  color: var(--color-grey-600);

  @media (max-width: 900px) {
    padding: 1.2rem 1.6rem;
  }
`;

const StyledRow = styled(CommonRow)`
  padding: 1.2rem 2.4rem;

  &:not(:last-child) {
    border-bottom: 1px solid var(--color-grey-100);
  }

  @media (max-width: 900px) {
    padding: 1rem 1.6rem;
  }
`;

const StyledBody = styled.section`
  margin: 0.4rem 0;
`;

const Footer = styled.footer`
  background-color: var(--color-grey-50);
  display: flex;
  justify-content: center;
  padding: 1.2rem;

  /* This will hide the footer when it contains no child elements. Possible thanks to the parent selector :has 🎉 */
  &:not(:has(*)) {
    display: none;
  }
`;

const Empty = styled.p`
  font-size: 1.6rem;
  font-weight: 500;
  text-align: center;
  margin: 2.4rem;
`;

interface TableContextValue {
  columns: string;
}

const TableContext = createContext<TableContextValue | undefined>(undefined);

interface TableProps {
  columns: string;
  children: ReactNode;
}

function Table({ columns, children }: TableProps) {
  return (
    <TableContext.Provider value={{ columns }}>
      <StyledTable role="table">{children}</StyledTable>
    </TableContext.Provider>
  );
}

interface HeaderProps {
  children: ReactNode;
}

function Header({ children }: HeaderProps) {
  const { columns } = useContext(TableContext)!;
  return (
    <StyledHeader role="row" columns={columns} as="header">
      {children}
    </StyledHeader>
  );
}

interface RowProps {
  children: ReactNode;
}

function Row({ children }: RowProps) {
  const { columns } = useContext(TableContext)!;
  return (
    <StyledRow role="row" columns={columns}>
      {children}
    </StyledRow>
  );
}

interface BodyProps<T> {
  data: T[];
  render: (item: T) => ReactNode;
}

function Body<T>({ data, render }: BodyProps<T>) {
  if (!data.length) return <Empty>No hay registro de ningun dato.</Empty>;

  return <StyledBody>{data.map(render)}</StyledBody>;
}

Table.Header = Header;
Table.Body = Body;
Table.Row = Row;
Table.Footer = Footer;

export default Table;
