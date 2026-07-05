import WorkerTable from "../../features/workers/WorkerTable";
import Heading from "../../ui/Heading";
import Row from "../../ui/Row";

function Workers() {
  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">Trabajadores</Heading>
      </Row>
      <Row>
        <WorkerTable />
      </Row>
    </>
  );
}

export default Workers;
