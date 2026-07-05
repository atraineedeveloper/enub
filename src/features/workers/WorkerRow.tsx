import styled from "styled-components";
import Table from "../../ui/Table";
import Modal from "../../ui/Modal";
import Menus from "../../ui/Menus";
import UntypedCreateEditWorkerForm from "./CreateEditWorkerForm";
import UntypedLinkWorkerAccountForm from "./LinkWorkerAccountForm";
import { getProfilePicturePublicUrl } from "../../services/apiWorkers";
import {
  HiDocumentText,
  HiLink,
  HiPaperAirplane,
  HiPencil,
  HiUserPlus,
} from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../authentication/useProfile";
import { useCreateWorkerAccount } from "../authentication/useCreateWorkerAccount";
import { useResendWorkerAccessLink } from "../authentication/useResendWorkerAccessLink";
import { useLinkedWorkerAccounts } from "./useLinkedWorkerAccounts";
import type { Worker } from "./useWorkers";
import type { ComponentType } from "react";

// CreateEditWorkerForm.jsx / LinkWorkerAccountForm.jsx are untyped and out of
// scope (Phase 2). TS infers their `onCloseModal` param as required from the
// destructured-with-no-default JS signature, even though it's always supplied
// later by Modal.Window's cloneElement injection (or safely omitted, since
// both components call it via `onCloseModal?.()`). This local cast describes
// the real, optional contract without converting either file.
const CreateEditWorkerForm = UntypedCreateEditWorkerForm as ComponentType<{
  workerToEdit?: Worker;
  onCloseModal?: () => void;
}>;
const LinkWorkerAccountForm = UntypedLinkWorkerAccountForm as ComponentType<{
  workerId: number;
  onCloseModal?: () => void;
}>;

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

interface WorkerRowProps {
  worker: Worker;
}

function WorkerRow({ worker }: WorkerRowProps) {
  const navigate = useNavigate();
  const { isAdmin } = useProfile();
  const { createAccount } = useCreateWorkerAccount();
  const { resendAccessLink } = useResendWorkerAccessLink();
  const { linkedWorkerIds, isLoading: isLoadingLinkedAccounts } =
    useLinkedWorkerAccounts();
  const { profile_picture, name, type_worker, status, email } = worker;
  const profilePictureUrl = getProfilePicturePublicUrl(profile_picture);
  const isLinked = linkedWorkerIds.has(worker.id);
  const hasEmail = Boolean(email?.trim());
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
              {isAdmin && !isLoadingLinkedAccounts && !isLinked && hasEmail && (
                <Menus.Button
                  icon={<HiUserPlus />}
                  onClick={() => createAccount({ workerId: worker.id })}
                >
                  Crear cuenta de acceso
                </Menus.Button>
              )}
              {isAdmin && !isLoadingLinkedAccounts && isLinked && (
                <Menus.Button
                  icon={<HiPaperAirplane />}
                  onClick={() => resendAccessLink({ workerId: worker.id })}
                >
                  Reenviar enlace de acceso
                </Menus.Button>
              )}
              {isAdmin && !isLoadingLinkedAccounts && !isLinked && (
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
