import Table from "../../ui/Table";
import Menus from "../../ui/Menus";
import { HiPencil } from "react-icons/hi2";

function GroupRow({ group }) {
  const { id, year_of_admission, letter, degrees } = group;

  return (
    <Table.Row role="row">
      <p>{year_of_admission}</p>
      <p>{letter}</p>
      <p>{degrees.code}</p>
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

export default GroupRow;
