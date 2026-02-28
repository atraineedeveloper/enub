import { useState } from "react";
import Table from "../../ui/Table";
import { useUtilities } from "./useUtilities";
import Spinner from "../../ui/Spinner";
import OtherRow from "./OtherRow";
import ErrorMessage from "../../ui/ErrorMessage";
import { usePagination } from "../../hooks/usePagination";
import Pagination from "../../ui/Pagination";
import Row from "../../ui/Row";
import SearchBar from "../../ui/SearchBar";

function OtherTable() {
  const { isLoading, utilities, error } = useUtilities();
  const [searchTerm, setSearchTerm] = useState("");
  const filtered = (utilities ?? []).filter((utility) =>
    utility.value.toLowerCase().includes(searchTerm.toLowerCase())
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
          placeholder="Buscar registro..."
        />
      </Row>
      <Table columns="1fr 2fr 0.5fr">
        <Table.Header>
          <div>Registro</div>
          <div>Valor</div>
          <div></div>
        </Table.Header>
        <Table.Body
          data={paginatedData}
          render={(utility) => (
            <OtherRow utility={utility} key={utility.id} />
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

export default OtherTable;
