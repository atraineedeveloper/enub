import { useState } from "react";
import Spinner from "../../ui/Spinner";
import { useGroups } from "./useGroups";
import GroupRow from "./GroupRow";
import calculateSemesterGroup from "../../helpers/calculateSemesterGroup";
import Table from "../../ui/Table";
import ErrorMessage from "../../ui/ErrorMessage";
import { usePagination } from "../../hooks/usePagination";
import Pagination from "../../ui/Pagination";
import Row from "../../ui/Row";
import SearchBar from "../../ui/SearchBar";
import Select from "../../ui/Select";

export default function GroupTable() {
  const { isLoading, groups, error } = useGroups();
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("active");
  const [academic, setAcademic] = useState("all");
  const filtered = (groups ?? []).filter(group => {
    const grade = calculateSemesterGroup(group.year_of_admission);
    const term = searchTerm.trim().toLowerCase();
    return (status === "all" || (status === "archived" ? !!group.archived_at : !group.archived_at))
      && (academic === "all" || (academic === "current" && grade >= 1 && grade <= 8) || (academic === "graduated" && grade > 8) || (academic === "future" && grade < 1))
      && [group.year_of_admission, group.letter, group.degrees?.code, group.degrees?.name].some(value => String(value ?? "").toLowerCase().includes(term));
  });
  const { currentPage, totalPages, totalCount, paginatedData, setCurrentPage } = usePagination(filtered);
  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={error.message} />;
  return (
    <Row>
      <Row type="horizontal">
        <SearchBar value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} placeholder="Buscar grupo..." />
        <Select aria-label="Estado administrativo" value={status} onChange={e => { setStatus(e.target.value); setCurrentPage(1); }}>
          <option value="active">Activos</option><option value="archived">Archivados</option><option value="all">Todos los estados</option>
        </Select>
        <Select aria-label="Situación académica" value={academic} onChange={e => { setAcademic(e.target.value); setCurrentPage(1); }}>
          <option value="all">Todas las generaciones</option><option value="current">En formación</option><option value="graduated">Egresados</option><option value="future">Futuros</option>
        </Select>
      </Row>
      <Table columns="1fr 1fr 1fr 1fr 0.5fr">
        <Table.Header><div>Año de admisión</div><div>Letra (Grupo)</div><div>Carrera</div><div>Estado</div><div>Acciones</div></Table.Header>
        <Table.Body data={paginatedData} render={group => <GroupRow group={group} key={group.id} />} />
        <Table.Footer><Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} onPageChange={setCurrentPage} /></Table.Footer>
      </Table>
    </Row>
  );
}
