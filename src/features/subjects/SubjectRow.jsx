import Table from "../../ui/Table";
import Menus from "../../ui/Menus";
import { HiPencil } from "react-icons/hi2";

function SubjectRow({ subject }) {
  const {
    id,
    semester,
    name,
    credits,
    hours_per_week,
    hours_per_semester,
    degrees,
    study_programs,
  } = subject;

  return (
    <Table.Row>
      <p>{semester}</p>
      <p>{name.toUpperCase()}</p>
      <p>{credits}</p>
      <p>{hours_per_week}</p>
      <p>{hours_per_semester}</p>
      <p>{study_programs.year}</p>
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

export default SubjectRow;
