import styled from "styled-components";
import Table from "../../ui/Table";
import Modal from "../../ui/Modal";
import Menus from "../../ui/Menus";
import CreateEditWorkerForm from "./CreateEditWorkerForm";
import { getProfilePicturePublicUrl } from "../../services/apiWorkers";
import { HiPencil } from "react-icons/hi2";

const Img = styled.img`
  display: block;
  width: 3rem;
  border-radius: 50%;
  aspect-ratio: 2 / 2;
  object-fit: cover;
  object-position: center;
  transform: scale(1.5) translateX(-7px);
`;

const Avatar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background-color: var(--color-brand-100);
  color: var(--color-brand-700);
  font-size: 1.2rem;
  font-weight: 700;
  transform: scale(1.5) translateX(-7px);
  flex-shrink: 0;
`;

function WorkerRow({ worker }) {
  const { profile_picture, name, type_worker, status } = worker;
  const profilePictureUrl = getProfilePicturePublicUrl(profile_picture);
  const initials = name
    ?.split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <Modal>
      <Table.Row>
        {profile_picture ? (
          <Img src={profilePictureUrl} alt={`Foto de ${name}`} />
        ) : (
          <Avatar>{initials}</Avatar>
        )}
        <p>{name}</p>
        <p>{type_worker}</p>
        <p>{status === 1 ? "Activo" : "Inactivo"}</p>
        <Menus>
          <Menus.Menu>
            <Menus.Toggle id={worker.id} />
            <Menus.List id={worker.id}>
              <Modal.Open opens="worker-form">
                <Menus.Button icon={<HiPencil />}>Editar</Menus.Button>
              </Modal.Open>
            </Menus.List>
          </Menus.Menu>
        </Menus>
      </Table.Row>
      <Modal.Window name="worker-form">
        <CreateEditWorkerForm workerToEdit={worker} />
      </Modal.Window>
    </Modal>
  );
}

export default WorkerRow;
