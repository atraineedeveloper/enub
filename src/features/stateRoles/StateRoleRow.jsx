import styled from "styled-components";
import Button from "../../ui/Button";
import Modal from "../../ui/Modal";
import CreateEditStateRoleForm from "./CreateEditStateRoleForm";
import { useState } from "react";

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
  const [editModal, setEditModal] = useState(false);

  return (
    <>
      <TableRow role="row">
        <p>{role.role}</p>
        <p>{role.name_worker}</p>
        <Button onClick={() => setEditModal(!editModal)}>Editar</Button>
      </TableRow>
      {editModal && (
        <Modal onClose={() => setEditModal(false)}>
          <CreateEditStateRoleForm stateRoleToEdit={role} />
        </Modal>
      )}
    </>
  );
}

export default StateRoleRow;
