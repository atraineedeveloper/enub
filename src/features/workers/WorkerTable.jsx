import Spinner from "../../ui/Spinner";
import Table from "../../ui/Table";
import { useWorkers } from "./useWorkers";
import WorkerRow from "./WorkerRow";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import Row from "../../ui/Row";
import CreateEditWorkerForm from "./CreateEditWorkerForm";

function WorkerTable() {
  const { isLoading, workers } = useWorkers();

  if (isLoading) return <Spinner />;

  return (
    <Row>
      <Row type="horizontal">
        <div></div>
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
          data={workers}
          render={(worker) => <WorkerRow worker={worker} key={worker.id} />}
        />
      </Table>
    </Row>
  );
}

export default WorkerTable;
