import Spinner from "../../ui/Spinner";
import Table from "../../ui/Table";
import { useWorkers } from "./useWorkers";
import WorkerRow from "./WorkerRow";

function WorkerTable() {
  const { isLoading, workers } = useWorkers();

  if (isLoading) return <Spinner />;

  return (
    <Table columns="0.3fr 3fr 1fr 1fr 1fr">
      <Table.Header>
        <div>Foto</div>
        <div>Nombre</div>
        <div>Tipo de Trabajador</div>
        <div>Estado</div>
        <div></div>
      </Table.Header>
      <Table.Body
        data={workers || []}
        render={(worker: any) => <WorkerRow worker={worker} key={worker.id} />}
      />
    </Table>
  );
}

export default WorkerTable;
