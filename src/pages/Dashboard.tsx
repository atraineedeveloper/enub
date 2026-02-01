import styled from "styled-components";
import Heading from "../ui/Heading";
import Row from "../ui/Row";
import Button from "../ui/Button";
import { Link } from "react-router-dom";
import { useSemesters } from "../features/semesters/useSemesters";
import { useWorkers } from "../features/workers/useWorkers";
import { useSubjects } from "../features/subjects/useSubjects";
import { useGroups } from "../features/groups/useGroups";
import Spinner from "../ui/Spinner";

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  gap: 1.6rem;
  margin: 2rem 0 3rem;
`;

const StatCard = styled.div`
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  padding: 1.6rem 1.8rem;
  box-shadow: var(--shadow-sm);
`;

const StatLabel = styled.p`
  font-size: 1.4rem;
  color: var(--color-grey-600);
  margin-bottom: 0.6rem;
`;

const StatValue = styled.p`
  font-size: 3rem;
  font-weight: 700;
  color: var(--color-brand-700);
`;

const Actions = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
  gap: 1rem;
`;

const ActionCard = styled.div`
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  padding: 1.4rem 1.6rem;
  background: var(--color-grey-0);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const ActionTitle = styled.h3`
  font-size: 1.6rem;
  color: var(--color-grey-800);
`;

const ActionText = styled.p`
  font-size: 1.4rem;
  color: var(--color-grey-600);
  flex: 1;
`;

function Dashboard() {
  const { semesters, isLoading: loadingSem } = useSemesters();
  const { workers, isLoading: loadingWorkers } = useWorkers();
  const { subjects, isLoading: loadingSubjects } = useSubjects();
  const { groups, isLoading: loadingGroups } = useGroups();

  const isLoading =
    loadingSem || loadingWorkers || loadingSubjects || loadingGroups;

  if (isLoading) return <Spinner />;

  return (
    <>
      <Row type="vertical">
        <Heading as="h1">Panel general</Heading>
        <p style={{ color: "var(--color-grey-600)" }}>
          Un vistazo rápido a los datos clave y accesos directos.
        </p>
      </Row>

      <Grid>
        <StatCard>
          <StatLabel>Semestres activos</StatLabel>
          <StatValue>{semesters?.length ?? 0}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>Trabajadores</StatLabel>
          <StatValue>{workers?.length ?? 0}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>Asignaturas</StatLabel>
          <StatValue>{subjects?.length ?? 0}</StatValue>
        </StatCard>
        <StatCard>
          <StatLabel>Grupos</StatLabel>
          <StatValue>{groups?.length ?? 0}</StatValue>
        </StatCard>
      </Grid>

      <Actions>
        <ActionCard>
          <ActionTitle>Administrar horarios</ActionTitle>
          <ActionText>
            Ingresa a los semestres para gestionar horarios escolares y de
            docentes.
          </ActionText>
          <Button as={Link} to="/semesters">
            Ir a semestres
          </Button>
        </ActionCard>

        <ActionCard>
          <ActionTitle>Registrar asignaturas</ActionTitle>
          <ActionText>
            Alta y edición de materias, su semestre y programa académico.
          </ActionText>
          <Button as={Link} to="/subjects" variation="secondary">
            Ver asignaturas
          </Button>
        </ActionCard>

        <ActionCard>
          <ActionTitle>Gestionar trabajadores</ActionTitle>
          <ActionText>
            Revisa el padrón de maestros y personal, y sus roles asignados.
          </ActionText>
          <Button as={Link} to="/workers" variation="secondary">
            Ver trabajadores
          </Button>
        </ActionCard>

        <ActionCard>
          <ActionTitle>Grupos escolares</ActionTitle>
          <ActionText>
            Consulta o crea grupos por licenciatura y semestre en curso.
          </ActionText>
          <Button as={Link} to="/groups" variation="secondary">
            Ver grupos
          </Button>
        </ActionCard>
      </Actions>
    </>
  );
}

export default Dashboard;
