import styled from "styled-components";
import Modal from "../../ui/Modal";
import Menus from "../../ui/Menus";
import CreateEditStateRoleForm from "./CreateEditStateRoleForm";
import { HiPencil } from "react-icons/hi2";

const TableRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  column-gap: 2.4rem;
  align-items: center;
  padding: 1.4rem 2.4rem;

  &:not(:last-child) {
    border-bottom: 1px solid var(--color-grey-100);
  }
`;

function StateRoleRow({ role }) {
  return (
    <Modal>
      <TableRow role="row">
        <p>{role.role}</p>
        <p>{role.name_worker}</p>
        <Menus>
          <Menus.Menu>
            <Menus.Toggle id={role.id} />
            <Menus.List id={role.id}>
              <Modal.Open opens="state-role-form">
                <Menus.Button icon={<HiPencil />}>Editar</Menus.Button>
              </Modal.Open>
            </Menus.List>
          </Menus.Menu>
        </Menus>
      </TableRow>
      <Modal.Window name="state-role-form">
        <CreateEditStateRoleForm stateRoleToEdit={role} />
      </Modal.Window>
    </Modal>
  );
}

export default StateRoleRow;
