import styled from "styled-components";
import Button from "../../ui/Button";
import Modal from "../../ui/Modal";
import { useState } from "react";
import capitalizeName from "../../helpers/capitalizeFirstLetter";
import CreateEditRoleForm from "./CreateEditRoleForm";

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

function RoleRow({ role }: { role: any }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [editModal, setEditModal] = useState(false);

  return (
    <>
      <TableRow role="row">
        <p>{role.role}</p>
        <p>{capitalizeName(role.workers.name)}</p>
        <Modal>
          <Modal.Open opens="scholar-schedule-form">
            <Button>Editar</Button>
          </Modal.Open>
          <Modal.Window name="scholar-schedule-form">
            <CreateEditRoleForm
              roleToEdit={role}
              onCloseModal={() => setEditModal(false)}
            />
          </Modal.Window>
        </Modal>
      </TableRow>
    </>
  );
}

export default RoleRow;
