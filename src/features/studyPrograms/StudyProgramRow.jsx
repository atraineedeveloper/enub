
import Table from "../../ui/Table";
import Modal from "../../ui/Modal";
import Menus from "../../ui/Menus";
import CreateEditStudyProgramForm from "./CreateEditStudyProgramForm";
import { HiPencil } from "react-icons/hi2";

function StudyProgramRow({ program }) {
  return (
    <Modal>
      <Table.Row>
        <p>{program.year}</p>
        <p>{program.name}</p>
        <Menus>
          <Menus.Menu>
            <Menus.Toggle id={program.id} />
            <Menus.List id={program.id}>
              <Modal.Open opens="study-program-form">
                <Menus.Button icon={<HiPencil />}>Editar</Menus.Button>
              </Modal.Open>
            </Menus.List>
          </Menus.Menu>
        </Menus>
      </Table.Row>
      <Modal.Window name="study-program-form">
        <CreateEditStudyProgramForm programToEdit={program} />
      </Modal.Window>
    </Modal>
  );
}

export default StudyProgramRow;
