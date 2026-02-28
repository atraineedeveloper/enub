import { useState } from "react";
import styled from "styled-components";
import Spinner from "../../ui/Spinner";
import SemesterRow from "./SemesterRow";
import { useSemesters } from "./useSemesters";
import ErrorMessage from "../../ui/ErrorMessage";
import { usePagination } from "../../hooks/usePagination";
import Pagination from "../../ui/Pagination";
import Row from "../../ui/Row";
import SearchBar from "../../ui/SearchBar";

const Table = styled.div`
  border: 1px solid var(--color-grey-200);

  font-size: 1.4rem;
  background-color: var(--color-grey-0);
  border-radius: 7px;
  overflow: hidden;
`;

const TableHeader = styled.header`
  display: grid;
  grid-template-columns: 1fr 1fr 0.5fr;
  column-gap: 2.4rem;
  align-items: center;

  background-color: var(--color-grey-50);
  border-bottom: 1px solid var(--color-grey-100);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-weight: 600;
  color: var(--color-grey-600);
  padding: 1.6rem 2.4rem;
`;

const TableFooter = styled.footer`
  background-color: var(--color-grey-50);
  display: flex;
  justify-content: center;
  padding: 1.2rem;

  &:not(:has(*)) {
    display: none;
  }
`;

function SemesterTable() {
  const { isLoading, semesters, error } = useSemesters();
  const [searchTerm, setSearchTerm] = useState("");
  const filtered = (semesters ?? []).filter(
    (sem) =>
      sem.semester.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sem.school_year.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const { currentPage, totalPages, totalCount, paginatedData, setCurrentPage } =
    usePagination(filtered);

  function handleSearch(e) {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  }

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={error.message} />;

  return (
    <Row>
      <Row type="horizontal">
        <SearchBar
          value={searchTerm}
          onChange={handleSearch}
          placeholder="Buscar semestre..."
        />
      </Row>
      <Table role="table">
        <TableHeader role="row">
          <div>Semestre</div>
          <div>Ciclo Escolar</div>
          <div></div>
        </TableHeader>
        {paginatedData.map((semester) => (
          <SemesterRow semester={semester} key={semester.id} />
        ))}
        <TableFooter>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setCurrentPage}
          />
        </TableFooter>
      </Table>
    </Row>
  );
}

export default SemesterTable;
