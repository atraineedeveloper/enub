import Spinner from "../../ui/Spinner";
import { useGroups } from "./useGroups";
import GroupRow from "./GroupRow";
import calculateSemesterGroup from "../../helpers/calculateSemesterGroup";
import Table from "../../ui/Table";

function GroupTable() {
  const { isLoading, groups } = useGroups();

  if (isLoading) return <Spinner />;

  const currentGroups = groups?.filter((group: any) => {
    // if the group is below eight semester
    return calculateSemesterGroup(group.year_of_admission) <= 8;
  });

  return (
    <Table columns="1fr 1fr 1fr 1fr">
      <Table.Header>
        <div>Año de admisión</div>
        <div>Letra (Grupo)</div>
        <div>Carrera</div>
        <div></div>
      </Table.Header>
      <Table.Body
        data={currentGroups || []}
        render={(group: any) => <GroupRow group={group} key={group.id} />}
      />
    </Table>
  );
}

export default GroupTable;
