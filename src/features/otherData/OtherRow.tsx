import Modal from "../../ui/Modal";
import Menus from "../../ui/Menus";
import Table from "../../ui/Table";
import CreateEditOtherForm from "./CreateEditOtherForm";
import { HiPencil } from "react-icons/hi2";
import type { Utility } from "./useUtilities";

interface OtherRowProps {
  utility: Utility;
}

function OtherRow({ utility }: OtherRowProps) {
  const { description, value } = utility;

  return (
    <Modal>
      <Table.Row>
        <p>{description}</p>
        <p>{value}</p>
        <Menus>
          <Menus.Menu>
            <Menus.Toggle id={utility.id} />
            <Menus.List id={utility.id}>
              <Modal.Open opens="other-form">
                <Menus.Button icon={<HiPencil />}>Editar</Menus.Button>
              </Modal.Open>
            </Menus.List>
          </Menus.Menu>
        </Menus>
      </Table.Row>
      <Modal.Window name="other-form">
        <CreateEditOtherForm otherToEdit={utility} />
      </Modal.Window>
    </Modal>
  );
}

export default OtherRow;
