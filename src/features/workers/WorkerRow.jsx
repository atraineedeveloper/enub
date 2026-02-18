import styled from "styled-components";
import Table from "../../ui/Table";
import Modal from "../../ui/Modal";
import CreateEditWorkerForm from "./CreateEditWorkerForm";
import Button from "../../ui/Button";
import { getProfilePicturePublicUrl } from "../../services/apiWorkers";

const Img = styled.img`
  display: block;
  width: 3rem;
  border-radius: 50%;
  aspect-ratio: 2 / 2;
  object-fit: cover;
  object-position: center;
  transform: scale(1.5) translateX(-7px);
`;

function WorkerRow({ worker }) {
  const { profile_picture, name, type_worker, status } = worker;
  const profilePictureUrl = getProfilePicturePublicUrl(profile_picture);

  return (
    <>
      <Table.Row>
        {profile_picture ? (
          <Img src={profilePictureUrl} alt={`Foto de ${name}`} />
        ) : (
          <p></p>
        )}
        <p>{name}</p>
        <p>{type_worker}</p>
        <p>{status === 1 ? "Activo" : "Inactivo"}</p>
        <Modal>
          <Modal.Open opens="worker-form">
            <Button>Editar</Button>
          </Modal.Open>
          <Modal.Window name="worker-form">
            <CreateEditWorkerForm
              workerToEdit={worker}
            />
          </Modal.Window>
        </Modal>
      </Table.Row>
    </>
  );
}

export default WorkerRow;
