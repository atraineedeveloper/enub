/* eslint-disable react/prop-types */
import styled from "styled-components";
import Table from "../../ui/Table";
import Modal from "../../ui/Modal";
import Menus from "../../ui/Menus";
import CreateEditWorkerForm from "./CreateEditWorkerForm";
import LinkWorkerAccountForm from "./LinkWorkerAccountForm";
import { getProfilePicturePublicUrl } from "../../services/apiWorkers";
import { HiDocumentText, HiLink, HiPencil, HiUserPlus } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../authentication/useProfile";
import { useCreateWorkerAccount } from "../authentication/useCreateWorkerAccount";

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
  const navigate = useNavigate();
  const { isAdmin } = useProfile();
  const { createAccount } = useCreateWorkerAccount();
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
              <Menus.Button
                icon={<HiDocumentText />}
                onClick={() => navigate(`/workers/${worker.id}/documents`)}
              >
                Documentos
              </Menus.Button>
              <Modal.Open opens="worker-form">
                <Menus.Button icon={<HiPencil />}>Editar</Menus.Button>
              </Modal.Open>
              {isAdmin && (
                <Menus.Button
                  icon={<HiUserPlus />}
                  onClick={() => createAccount({ workerId: worker.id })}
                >
                  Crear cuenta de acceso
                </Menus.Button>
              )}
              {isAdmin && (
                <Modal.Open opens="link-worker-account-form">
                  <Menus.Button icon={<HiLink />}>
                    Vincular cuenta existente
                  </Menus.Button>
                </Modal.Open>
              )}
            </Menus.List>
          </Menus.Menu>
        </Menus>
      </Table.Row>
      <Modal.Window name="worker-form">
        <CreateEditWorkerForm workerToEdit={worker} />
      </Modal.Window>
      {isAdmin && (
        <Modal.Window name="link-worker-account-form">
          <LinkWorkerAccountForm workerId={worker.id} />
        </Modal.Window>
      )}
    </Modal>
  );
}

export default WorkerRow;
