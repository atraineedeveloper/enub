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

function StateRoleRow({ role }: { role: any }) {
  return (
    <Modal>
      <TableRow role="row">
        <p>{role.role}</p>
        <p>{role.name_worker}</p>
        <Modal.Open opens="edit">
          <Button>Editar</Button>
        </Modal.Open>
      </TableRow>
      <Modal.Window name="edit">
        <CreateEditStateRoleForm stateRoleToEdit={role} />
      </Modal.Window>
    </Modal>
  );
}

export default StateRoleRow;
