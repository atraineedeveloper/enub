import styled from "styled-components";
import Modal from "../../ui/Modal";
import Menus from "../../ui/Menus";
import capitalizeName from "../../helpers/capitalizeFirstLetter";
import CreateEditRoleForm from "./CreateEditRoleForm";
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

function RoleRow({ role }) {
  return (
    <Modal>
      <TableRow role="row">
        <p>{role.role}</p>
        <p>{capitalizeName(role.workers.name)}</p>
        <Menus>
          <Menus.Menu>
            <Menus.Toggle id={role.id} />
            <Menus.List id={role.id}>
              <Modal.Open opens="role-form">
                <Menus.Button icon={<HiPencil />}>Editar</Menus.Button>
              </Modal.Open>
            </Menus.List>
          </Menus.Menu>
        </Menus>
      </TableRow>
      <Modal.Window name="role-form">
        <CreateEditRoleForm roleToEdit={role} />
      </Modal.Window>
    </Modal>
  );
}

export default RoleRow;
