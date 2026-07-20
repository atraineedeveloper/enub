import styled from "styled-components";
import Heading from "../../ui/Heading";
import Spinner from "../../ui/Spinner";
import ErrorMessage from "../../ui/ErrorMessage";
import Avatar from "../../ui/Avatar";
import { useMyWorkerProfile } from "./useMyWorkerProfile";
import { getProfilePicturePublicUrl } from "../../services/apiWorkers";
import type { MyDateOfAdmission, MySustenancePlaza } from "../../services/apiWorkers";
import {
  formatDateOfAdmissionType,
  formatDateOfAdmissionValue,
  formatOptionalWorkerField,
  formatWorkerType,
  NO_DATE_OF_ADMISSIONS_LABEL,
  NO_SUSTENANCE_PLAZAS_LABEL,
  sortDateOfAdmissions,
  sortSustenancePlazas,
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

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

const SectionHeading = styled(Heading)`
  font-size: 1.8rem;
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

// Plazas/fechas render as a stacked list of cards -- never a horizontal
// table, per this view's mobile-readability requirement. Each card is its
// own small <dl> so screen readers still get label/value pairs per plaza
// or fecha, not just a wall of text.
const RelationList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

const RelationCard = styled.li`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 0.8rem 1.6rem;
  padding: 1.2rem 1.6rem;
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-sm);
`;

const RelationEmptyMessage = styled.p`
  color: var(--color-grey-600);
  font-size: 1.4rem;
`;

const EmptyStateMessage = styled.p`
  color: var(--color-grey-600);
  font-size: 1.6rem;
  text-align: center;
  margin: 4.8rem auto;
`;

function SustenancePlazaCard({ plaza }: { plaza: MySustenancePlaza }) {
  return (
    <RelationCard>
      <FieldGroup>
        <FieldLabel>Sostenimiento</FieldLabel>
        <FieldValue>{formatOptionalWorkerField(plaza.sustenance)}</FieldValue>
      </FieldGroup>
      <FieldGroup>
        <FieldLabel>Plaza</FieldLabel>
        <FieldValue>{formatOptionalWorkerField(plaza.plaza)}</FieldValue>
      </FieldGroup>
      <FieldGroup>
        <FieldLabel>Clave de pago</FieldLabel>
        <FieldValue>{formatOptionalWorkerField(plaza.payment_key)}</FieldValue>
      </FieldGroup>
    </RelationCard>
  );
}

function DateOfAdmissionCard({ admission }: { admission: MyDateOfAdmission }) {
  return (
    <RelationCard>
      <FieldGroup>
        <FieldLabel>Tipo</FieldLabel>
        <FieldValue>{formatDateOfAdmissionType(admission.type)}</FieldValue>
      </FieldGroup>
      <FieldGroup>
        <FieldLabel>Fecha</FieldLabel>
        <FieldValue>
          {formatDateOfAdmissionValue(admission.date_of_admission)}
        </FieldValue>
      </FieldGroup>
    </RelationCard>
  );
}

// Read-only -- no editing control of any kind. Identity (authUserId,
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
  const sortedSustenancePlazas = sortSustenancePlazas(
    myWorkerProfile.sustenance_plazas
  );
  const sortedDateOfAdmissions = sortDateOfAdmissions(
    myWorkerProfile.date_of_admissions
  );

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

      <Section aria-labelledby="profile-personal-data">
        <SectionHeading as="h2" id="profile-personal-data">
          Datos personales
        </SectionHeading>
        <FieldGrid>
          <FieldGroup>
            <FieldLabel>Nombre</FieldLabel>
            <FieldValue>{formatOptionalWorkerField(myWorkerProfile.name)}</FieldValue>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>RFC</FieldLabel>
            <FieldValue>{formatOptionalWorkerField(myWorkerProfile.RFC)}</FieldValue>
          </FieldGroup>
        </FieldGrid>
      </Section>

      <Section aria-labelledby="profile-contact">
        <SectionHeading as="h2" id="profile-contact">
          Contacto
        </SectionHeading>
        <FieldGrid>
          <FieldGroup>
            <FieldLabel>Correo</FieldLabel>
            <FieldValue>{formatOptionalWorkerField(myWorkerProfile.email)}</FieldValue>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>Teléfono</FieldLabel>
            <FieldValue>{formatOptionalWorkerField(myWorkerProfile.phone)}</FieldValue>
          </FieldGroup>
        </FieldGrid>
      </Section>

      <Section aria-labelledby="profile-address">
        <SectionHeading as="h2" id="profile-address">
          Domicilio
        </SectionHeading>
        <FieldGrid>
          <FieldGroup>
            <FieldLabel>Calle</FieldLabel>
            <FieldValue>{formatOptionalWorkerField(myWorkerProfile.street)}</FieldValue>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>Colonia</FieldLabel>
            <FieldValue>
              {formatOptionalWorkerField(myWorkerProfile.neighborhood)}
            </FieldValue>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>Código postal</FieldLabel>
            <FieldValue>
              {formatOptionalWorkerField(myWorkerProfile.post_code)}
            </FieldValue>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>Ciudad</FieldLabel>
            <FieldValue>{formatOptionalWorkerField(myWorkerProfile.city)}</FieldValue>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>Estado</FieldLabel>
            <FieldValue>{formatOptionalWorkerField(myWorkerProfile.state)}</FieldValue>
          </FieldGroup>
        </FieldGrid>
      </Section>

      <Section aria-labelledby="profile-work-info">
        <SectionHeading as="h2" id="profile-work-info">
          Información laboral
        </SectionHeading>
        <FieldGrid>
          <FieldGroup>
            <FieldLabel>Especialidad</FieldLabel>
            <FieldValue>
              {formatOptionalWorkerField(myWorkerProfile.specialty)}
            </FieldValue>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>Función que desempeña</FieldLabel>
            <FieldValue>
              {formatOptionalWorkerField(myWorkerProfile.function_performed)}
            </FieldValue>
          </FieldGroup>
          <FieldGroup>
            <FieldLabel>Estatus</FieldLabel>
            <FieldValue>{translateWorkerStatus(myWorkerProfile.status)}</FieldValue>
          </FieldGroup>
        </FieldGrid>
      </Section>

      <Section aria-labelledby="profile-plazas">
        <SectionHeading as="h2" id="profile-plazas">
          Plazas
        </SectionHeading>
        {sortedSustenancePlazas.length === 0 ? (
          <RelationEmptyMessage>{NO_SUSTENANCE_PLAZAS_LABEL}</RelationEmptyMessage>
        ) : (
          <RelationList>
            {sortedSustenancePlazas.map((plaza, index) => (
              // No `id` is fetched for this read-only, minimized
              // projection (see apiWorkers.ts) -- the sorted index is a
              // stable-enough React key here, since the list is fully
              // re-derived (sorted) from `myWorkerProfile` on every render.
              <SustenancePlazaCard key={index} plaza={plaza} />
            ))}
          </RelationList>
        )}
      </Section>

      <Section aria-labelledby="profile-admissions">
        <SectionHeading as="h2" id="profile-admissions">
          Fechas de admisión
        </SectionHeading>
        {sortedDateOfAdmissions.length === 0 ? (
          <RelationEmptyMessage>{NO_DATE_OF_ADMISSIONS_LABEL}</RelationEmptyMessage>
        ) : (
          <RelationList>
            {sortedDateOfAdmissions.map((admission, index) => (
              <DateOfAdmissionCard key={index} admission={admission} />
            ))}
          </RelationList>
        )}
      </Section>
    </ProfileCard>
  );
}

export default MyProfileView;
