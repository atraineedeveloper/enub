import Table from "../../ui/Table";
import Menus from "../../ui/Menus";
import { HiPencil } from "react-icons/hi2";

function DegreeRow({ degree }) {
  const { id, code, name } = degree;

  return (
    <Table.Row>
      <p>{code}</p>
      <p>{name}</p>
      <Menus>
        <Menus.Menu>
          <Menus.Toggle id={id} />
          <Menus.List id={id}>
            <Menus.Button icon={<HiPencil />}>Editar</Menus.Button>
          </Menus.List>
        </Menus.Menu>
      </Menus>
    </Table.Row>
  );
}

export default DegreeRow;
