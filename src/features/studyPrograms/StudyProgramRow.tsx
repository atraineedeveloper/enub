import { useState } from "react";
import Table from "../../ui/Table";
import Button from "../../ui/Button";
import Modal from "../../ui/Modal";
import CreateEditStudyProgramForm from "./CreateEditStudyProgramForm";

function StudyProgramRow({ program }: { program: any }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showEditForm, setShowEditForm] = useState(false);

  return (
    <Table.Row>
      <p>{program.year}</p>
      <p>{program.name}</p>
      <Modal>
        <Modal.Open opens="study-program-form">
          <Button>Editar</Button>
        </Modal.Open>
        <Modal.Window name="study-program-form">
          <CreateEditStudyProgramForm
            programToEdit={program}
            onCloseModal={() => setShowEditForm(false)}
          />
        </Modal.Window>
      </Modal>
    </Table.Row>
  );
}

export default StudyProgramRow;
