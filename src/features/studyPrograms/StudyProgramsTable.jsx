import { useState } from "react";
import Spinner from "../../ui/Spinner";
import { useStudyPrograms } from "./useStudyPrograms";
import Table from "../../ui/Table";
import StudyProgramRow from "./StudyProgramRow";
import ErrorMessage from "../../ui/ErrorMessage";
import { usePagination } from "../../hooks/usePagination";
import Pagination from "../../ui/Pagination";
import Row from "../../ui/Row";
import SearchBar from "../../ui/SearchBar";

function StudyProgramsTable() {
  const { isLoading, studyPrograms, error } = useStudyPrograms();
  const [searchTerm, setSearchTerm] = useState("");
  const filtered = (studyPrograms ?? []).filter((program) =>
    program.name.toLowerCase().includes(searchTerm.toLowerCase())
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
          placeholder="Buscar plan de estudio..."
        />
      </Row>
      <Table columns="1fr 2fr 0.7fr">
        <Table.Header>
          <div>Año</div>
          <div>Nombre</div>
          <div></div>
        </Table.Header>
        <Table.Body
          data={paginatedData}
          render={(program) => (
            <StudyProgramRow program={program} key={program.id} />
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

export default StudyProgramsTable;
