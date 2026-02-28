import { useState } from "react";
import Spinner from "../../ui/Spinner";
import Table from "../../ui/Table";
import { useWorkers } from "./useWorkers";
import WorkerRow from "./WorkerRow";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import Row from "../../ui/Row";
import CreateEditWorkerForm from "./CreateEditWorkerForm";
import ErrorMessage from "../../ui/ErrorMessage";
import { usePagination } from "../../hooks/usePagination";
import Pagination from "../../ui/Pagination";
import SearchBar from "../../ui/SearchBar";

function WorkerTable() {
  const { isLoading, workers, error } = useWorkers({ fullDetails: true });
  const [searchTerm, setSearchTerm] = useState("");
  const filtered = (workers ?? []).filter((worker) =>
    worker.name.toLowerCase().includes(searchTerm.toLowerCase())
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
          placeholder="Buscar trabajador..."
        />
        <Modal>
          <Modal.Open opens="create-worker-form">
            <Button>Añadir trabajador</Button>
          </Modal.Open>
          <Modal.Window name="create-worker-form">
            <CreateEditWorkerForm />
          </Modal.Window>
        </Modal>
      </Row>

      <Table columns="0.3fr 3fr 1fr 1fr 1fr">
        <Table.Header>
          <div>Foto</div>
          <div>Nombre</div>
          <div>Tipo de Trabajador</div>
          <div>Estado</div>
          <div></div>
        </Table.Header>
        <Table.Body
          data={paginatedData}
          render={(worker) => <WorkerRow worker={worker} key={worker.id} />}
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

export default WorkerTable;
