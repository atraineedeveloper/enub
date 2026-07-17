import styled from "styled-components";
import Heading from "../../ui/Heading";
import Spinner from "../../ui/Spinner";
import ErrorMessage from "../../ui/ErrorMessage";
import Avatar from "../../ui/Avatar";
import { useMyWorkerProfile } from "./useMyWorkerProfile";
import { getProfilePicturePublicUrl } from "../../services/apiWorkers";
import {
  formatOptionalWorkerField,
  formatWorkerType,
  translateWorkerStatus,
} from "./workerProfileLabels";

const ProfileCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2.4rem;
  max-width: 64rem;
`;

const ProfileHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 1.6rem;
`;

const NameBlock = styled.div`
  min-width: 0;
`;

const WorkerName = styled(Heading)`
  overflow-wrap: break-word;
`;

const RoleLabel = styled.p`
  color: var(--color-grey-500);
  font-size: 1.4rem;
`;

const FieldGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
  gap: 1.6rem 2.4rem;
`;

const FieldGroup = styled.div`
  min-width: 0;
`;

const FieldLabel = styled.dt`
  font-size: 1.2rem;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--color-grey-500);
  margin-bottom: 0.4rem;
`;

const FieldValue = styled.dd`
  font-size: 1.5rem;
  color: var(--color-grey-800);
  overflow-wrap: break-word;
`;

const EmptyStateMessage = styled.p`
  color: var(--color-grey-600);
  font-size: 1.6rem;
  text-align: center;
  margin: 4.8rem auto;
`;

// Read-only -- no editing control of any kind. Renders exactly the 8
// allow-listed fields (design.md §3/§10), each with its own exact
// fallback text; the profile picture goes through the same Avatar
// fallback pattern used elsewhere in the app. Identity (authUserId,
// workerId) is resolved inside useMyWorkerProfile from the authenticated
// session/profile path, not passed in as a prop here.
function MyProfileView() {
  const { isLoading, myWorkerProfile, error } = useMyWorkerProfile();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message="La información no pudo cargarse." />;

  if (!myWorkerProfile) {
    return (
      <EmptyStateMessage>
        No se encontró tu información de trabajador. Contacta a un administrador.
      </EmptyStateMessage>
    );
  }

  const displayName = myWorkerProfile.name?.trim() || "Usuario";
  const avatarUrl = myWorkerProfile.profile_picture
    ? getProfilePicturePublicUrl(myWorkerProfile.profile_picture) || null
    : null;

  return (
    <ProfileCard>
      <Heading as="h1">Mi información</Heading>

      <ProfileHeader>
        <Avatar src={avatarUrl} name={displayName} size="6.4rem" />
        <NameBlock>
          <WorkerName as="h2">{displayName}</WorkerName>
          <RoleLabel>{formatWorkerType(myWorkerProfile.type_worker)}</RoleLabel>
        </NameBlock>
      </ProfileHeader>

      <FieldGrid>
        <FieldGroup>
          <FieldLabel>Correo</FieldLabel>
          <FieldValue>{formatOptionalWorkerField(myWorkerProfile.email)}</FieldValue>
        </FieldGroup>

        <FieldGroup>
          <FieldLabel>Teléfono</FieldLabel>
          <FieldValue>{formatOptionalWorkerField(myWorkerProfile.phone)}</FieldValue>
        </FieldGroup>

        <FieldGroup>
          <FieldLabel>Estado</FieldLabel>
          <FieldValue>{translateWorkerStatus(myWorkerProfile.status)}</FieldValue>
        </FieldGroup>

        <FieldGroup>
          <FieldLabel>Especialidad</FieldLabel>
          <FieldValue>{formatOptionalWorkerField(myWorkerProfile.specialty)}</FieldValue>
        </FieldGroup>

        <FieldGroup>
          <FieldLabel>Función que desempeña</FieldLabel>
          <FieldValue>
            {formatOptionalWorkerField(myWorkerProfile.function_performed)}
          </FieldValue>
        </FieldGroup>
      </FieldGrid>
    </ProfileCard>
  );
}

export default MyProfileView;
