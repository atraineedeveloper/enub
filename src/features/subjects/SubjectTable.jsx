import { useState } from "react";
import Spinner from "../../ui/Spinner";
import SubjectRow from "./SubjectRow";
import { useSubjects } from "./useSubjects";
import Table from "../../ui/Table";
import ErrorMessage from "../../ui/ErrorMessage";
import { usePagination } from "../../hooks/usePagination";
import Pagination from "../../ui/Pagination";
import Row from "../../ui/Row";
import SearchBar from "../../ui/SearchBar";

function SubjectTable() {
  const { isLoading, subjects, error } = useSubjects();
  const [searchTerm, setSearchTerm] = useState("");
  const filtered = (subjects ?? []).filter((subject) =>
    subject.name.toLowerCase().includes(searchTerm.toLowerCase())
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
          placeholder="Buscar asignatura..."
        />
      </Row>
      <Table columns="1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr">
        <Table.Header>
          <div>Semestre</div>
          <div>Nombre</div>
          <div>Créditos</div>
          <div>Horas por semana</div>
          <div>Horas por semestre</div>
          <div>Programa de estudio</div>
          <div>Licenciatura</div>
          <div></div>
        </Table.Header>
        <Table.Body
          data={paginatedData}
          render={(subject) => (
            <SubjectRow subject={subject} key={subject.id} />
          )}
        />
        <Table.Footer>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setCurrentPage}
          />
        </Table.Footer>
      </Table>
    </Row>
  );
}

export default SubjectTable;
