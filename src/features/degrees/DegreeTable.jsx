import { useState } from "react";
import DegreeRow from "./DegreeRow";
import Spinner from "../../ui/Spinner";
import { useDegrees } from "./useDegrees";
import Table from "../../ui/Table";
import ErrorMessage from "../../ui/ErrorMessage";
import { usePagination } from "../../hooks/usePagination";
import Pagination from "../../ui/Pagination";
import Row from "../../ui/Row";
import SearchBar from "../../ui/SearchBar";

function DegreeTable() {
  const { isLoading, degrees, error } = useDegrees();
  const [searchTerm, setSearchTerm] = useState("");
  const filtered = (degrees ?? []).filter(
    (degree) =>
      degree.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      degree.code.toLowerCase().includes(searchTerm.toLowerCase())
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
          placeholder="Buscar licenciatura..."
        />
      </Row>
      <Table columns="1fr 3fr 0.5fr">
        <Table.Header>
          <div>Código</div>
          <div>Nombre</div>
          <div></div>
        </Table.Header>

        <Table.Body
          data={paginatedData}
          render={(degree) => <DegreeRow degree={degree} key={degree.id} />}
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

export default DegreeTable;
