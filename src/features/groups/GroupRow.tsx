import Table from "../../ui/Table";
import Menus from "../../ui/Menus";
import Modal from "../../ui/Modal";
import { HiPencil, HiArchiveBox, HiArrowUturnLeft, HiTrash } from "react-icons/hi2";
import type { Group } from "./useGroups";
import GroupActionForm from "./GroupActionForm";
import { useProfile } from "../authentication/useProfile";

export default function GroupRow({ group }: { group: Group }) {
  const { id, year_of_admission, letter, degrees, archived_at } = group;
  const { isStaffOrAdmin, isAdmin } = useProfile();
  return (
    <Table.Row>
      <p>{year_of_admission}</p>
      <p>{letter}</p>
      <p>{degrees?.code ?? "—"}</p>
      <p>{archived_at ? "Archivado" : "Activo"}</p>
      {isStaffOrAdmin ? (
        <Modal>
          <Menus>
            <Menus.Menu>
              <Menus.Toggle id={id} />
              <Menus.List id={id}>
                <Modal.Open opens={`edit-group-${id}`}><Menus.Button icon={<HiPencil />}>Editar</Menus.Button></Modal.Open>
                {archived_at ? <Modal.Open opens={`restore-group-${id}`}><Menus.Button icon={<HiArrowUturnLeft />}>Reactivar</Menus.Button></Modal.Open> : <Modal.Open opens={`archive-group-${id}`}><Menus.Button icon={<HiArchiveBox />}>Archivar</Menus.Button></Modal.Open>}
                {isAdmin && <Modal.Open opens={`delete-group-${id}`}><Menus.Button icon={<HiTrash />}>Eliminar</Menus.Button></Modal.Open>}
              </Menus.List>
            </Menus.Menu>
          </Menus>
          <Modal.Window name={`edit-group-${id}`} title="Editar grupo"><GroupActionForm group={group} action="edit" /></Modal.Window>
          <Modal.Window name={`archive-group-${id}`} title="Archivar grupo"><GroupActionForm group={group} action="archive" /></Modal.Window>
          <Modal.Window name={`restore-group-${id}`} title="Reactivar grupo"><GroupActionForm group={group} action="restore" /></Modal.Window>
          <Modal.Window name={`delete-group-${id}`} title="Eliminar grupo"><GroupActionForm group={group} action="delete" /></Modal.Window>
        </Modal>
      ) : <span />}
    </Table.Row>
  );
}
