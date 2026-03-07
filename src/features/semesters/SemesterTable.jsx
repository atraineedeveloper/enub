import { useState } from "react";
import styled from "styled-components";
import Spinner from "../../ui/Spinner";
import SemesterRow from "./SemesterRow";
import { useSemesters } from "./useSemesters";
import ErrorMessage from "../../ui/ErrorMessage";
import Row from "../../ui/Row";
import SearchBar from "../../ui/SearchBar";
import { FaCalendar } from "react-icons/fa";

const CardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
  gap: 1.6rem;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  padding: 6rem 2rem;
  color: var(--color-grey-400);
`;

const EmptyText = styled.p`
  font-size: 1.6rem;
  color: var(--color-grey-500);
`;

function SemesterTable() {
  const { isLoading, semesters, error } = useSemesters();
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = (semesters ?? []).filter(
    (sem) =>
      sem.semester.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sem.school_year.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function handleSearch(e) {
    setSearchTerm(e.target.value);
  }

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={error.message} />;

  return (
    <Row>
      <SearchBar
        value={searchTerm}
        onChange={handleSearch}
        placeholder="Buscar semestre..."
      />
      {filtered.length === 0 ? (
        <EmptyState>
          <FaCalendar size={40} />
          <EmptyText>
            {searchTerm
              ? "No se encontraron semestres con esa búsqueda."
              : "No hay semestres registrados aún."}
          </EmptyText>
        </EmptyState>
      ) : (
        <CardsGrid>
          {filtered.map((semester) => (
            <SemesterRow semester={semester} key={semester.id} />
          ))}
        </CardsGrid>
      )}
    </Row>
  );
}

export default SemesterTable;
