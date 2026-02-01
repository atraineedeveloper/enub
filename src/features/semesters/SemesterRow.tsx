import styled from "styled-components";
import { NavLink } from "react-router-dom";

const TableRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 0.5fr;
  column-gap: 2.4rem;
  align-items: center;
  padding: 1.4rem 2.4rem;

  &:not(:last-child) {
    border-bottom: 1px solid var(--color-grey-100);
  }
`;

const ButtonLink = styled(NavLink)`
  border: none;
  border-radius: var(--border-radius-sm);
  box-shadow: var(--shadow-sm);

  font-size: 1.4rem;
  padding: 1.2rem 1.6rem;
  font-weight: 500;
  text-align: center;

  color: var(--color-brand-50);
  background-color: var(--color-brand-600);

  &:hover {
    background-color: var(--color-brand-700);
  }
`;

function SemesterRow({ semester }: { semester: any }) {
  const { semester: semesterRecord, school_year, id } = semester;
  return (
    <>
      <TableRow role="row">
        <p>{semesterRecord}</p>
        <p>{school_year}</p>
        <ButtonLink to={`/semesters/${id}`}>Administrar</ButtonLink>
      </TableRow>
    </>
  );
}

export default SemesterRow;
