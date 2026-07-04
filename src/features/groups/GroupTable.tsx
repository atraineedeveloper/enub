import { useState, type ChangeEvent, type ComponentType, type HTMLAttributes } from "react";
import Spinner from "../../ui/Spinner";
import { useGroups } from "./useGroups";
import GroupRow from "./GroupRow";
import calculateSemesterGroup from "../../helpers/calculateSemesterGroup";
import Table from "../../ui/Table";
import ErrorMessage from "../../ui/ErrorMessage";
import { usePagination } from "../../hooks/usePagination";
import Pagination from "../../ui/Pagination";
import UntypedRow from "../../ui/Row";
import SearchBar from "../../ui/SearchBar";

// Row.jsx is a plain, untyped styled-component whose `type` prop is only
// consumed via runtime prop interpolation (see Row.jsx) — this local cast
// describes its real contract without converting that out-of-scope file.
type RowProps = HTMLAttributes<HTMLDivElement> & {
  type?: "horizontal" | "vertical";
};
const Row = UntypedRow as ComponentType<RowProps>;

function GroupTable() {
  const { isLoading, groups, error } = useGroups();
  const [searchTerm, setSearchTerm] = useState("");

  const semesterFiltered =
    isLoading || error
      ? []
      : groups!.filter(
          (group) => calculateSemesterGroup(group.year_of_admission) <= 8
        );

  const filtered = semesterFiltered.filter(
    (group) =>
      group.year_of_admission!.toString().includes(searchTerm) ||
      group.letter!.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { currentPage, totalPages, totalCount, paginatedData, setCurrentPage } =
    usePagination(filtered);

  function handleSearch(e: ChangeEvent<HTMLInputElement>) {
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
          placeholder="Buscar grupo..."
        />
      </Row>
      <Table columns="1fr 1fr 1fr 1fr">
        <Table.Header>
          <div>Año de admisión</div>
          <div>Letra (Grupo)</div>
          <div>Carrera</div>
          <div></div>
        </Table.Header>
        <Table.Body
          data={paginatedData}
          render={(group) => <GroupRow group={group} key={group.id} />}
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

export default GroupTable;
