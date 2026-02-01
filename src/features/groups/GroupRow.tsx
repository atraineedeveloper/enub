import Table from "../../ui/Table";
import Button from "../../ui/Button";

function GroupRow({ group }: { group: any }) {
  const { year_of_admission, letter, degrees } = group;

  return (
    <>
      <Table.Row>
        <p>{year_of_admission}</p>
        <p>{letter}</p>
        <p>{degrees?.code}</p>
        <Button size="medium" variation="primary">
          Editar
        </Button>
      </Table.Row>
    </>
  );
}

export default GroupRow;
