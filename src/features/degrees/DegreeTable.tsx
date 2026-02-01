import DegreeRow from "./DegreeRow";
import Spinner from "../../ui/Spinner";
import { useDegrees } from "./useDegrees";
import Table from "../../ui/Table";

function DegreeTable() {
  const { isLoading, degrees } = useDegrees();

  if (isLoading) return <Spinner />;

  return (
    <Table columns="1fr 3fr 0.5fr">
      <Table.Header>
        <div>Código</div>
        <div>Nombre</div>
        <div></div>
      </Table.Header>

      <Table.Body
        data={degrees || []}
        render={(degree: any) => <DegreeRow degree={degree} key={degree.id} />}
      />
    </Table>
  );
}

export default DegreeTable;
