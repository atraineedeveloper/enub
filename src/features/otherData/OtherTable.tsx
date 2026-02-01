import Table from "../../ui/Table";
import { useUtilities } from "./useUtilities";
import Spinner from "../../ui/Spinner";
import OtherRow from "./OtherRow";

function OtherTable() {
  const { isLoading, utilities } = useUtilities();

  if (isLoading) return <Spinner />;

  return (
    <Table columns="1fr 2fr 0.5fr">
      <Table.Header>
        <div>Registro</div>
        <div>Valor</div>
        <div></div>
      </Table.Header>
      <Table.Body
        data={utilities || []}
        render={(utility: any) => <OtherRow utility={utility} key={utility.id} />}
      />
    </Table>
  );
}

export default OtherTable;
