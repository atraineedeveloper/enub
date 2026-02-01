import { useState } from "react";
import Button from "../../ui/Button";
import Modal from "../../ui/Modal";
import Table from "../../ui/Table";
import CreateEditOtherForm from "./CreateEditOtherForm";

function OtherRow({ utility }: { utility: any }) {
  const { description, value } = utility;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showEditForm, setShowEditForm] = useState(false);

  return (
    <>
      <Table.Row>
        <p>{description}</p>
        <p>{value}</p>
        <Modal>
          <Modal.Open opens="scholar-schedule-form">
            <Button variation="secondary">Editar</Button>
          </Modal.Open>
          <Modal.Window name="scholar-schedule-form">
            <CreateEditOtherForm
              otherToEdit={utility}
              onCloseModal={() => setShowEditForm(false)}
            />
          </Modal.Window>
        </Modal>
      </Table.Row>
    </>
  );
}

export default OtherRow;
