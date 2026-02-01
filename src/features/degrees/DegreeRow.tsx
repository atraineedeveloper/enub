import Table from "../../ui/Table";
import Button from "../../ui/Button";

function DegreeRow({ degree }: { degree: any }) {
  const { code, name } = degree;

  return (
    <>
      <Table.Row>
        <p>{code}</p>
        <p>{name}</p>
        <Button size="medium" variation="primary">
          Editar
        </Button>
      </Table.Row>
    </>
  );
}

export default DegreeRow;
