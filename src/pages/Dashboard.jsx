import styled, { keyframes } from "styled-components";
import Heading from "../ui/Heading";
import Row from "../ui/Row";
import Button from "../ui/Button";
import { Link } from "react-router-dom";
import { useSemesters } from "../features/semesters/useSemesters";
import { useWorkers } from "../features/workers/useWorkers";
import { useSubjects } from "../features/subjects/useSubjects";
import { useGroups } from "../features/groups/useGroups";
import { FaCalendar } from "react-icons/fa";
import { HiBookOpen, HiOutlineUsers, HiAcademicCap } from "react-icons/hi2";

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  gap: 1.6rem;
  margin: 2rem 0 3rem;
`;

const shimmer = keyframes`
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
`;

const StatCard = styled.div`
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  padding: 1.6rem 1.8rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  gap: 1.4rem;
`;

const iconThemes = {
  gold: { bg: "var(--color-gold-100)", color: "var(--color-gold-700)" },
  brand: { bg: "var(--color-brand-50)", color: "var(--color-brand-600)" },
  green: { bg: "var(--color-gov-green-100)", color: "var(--color-gov-green-700)" },
};

const StatIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4.8rem;
  height: 4.8rem;
  border-radius: var(--border-radius-md);
  background-color: ${(p) => iconThemes[p.$theme]?.bg ?? "var(--color-brand-50)"};
  color: ${(p) => iconThemes[p.$theme]?.color ?? "var(--color-brand-600)"};
  flex-shrink: 0;
`;

const StatContent = styled.div`
  display: flex;
  flex-direction: column;
`;

const StatLabel = styled.p`
  font-size: 1.4rem;
  color: var(--color-grey-600);
  margin-bottom: 0.4rem;
`;

const StatValue = styled.p`
  font-size: 3rem;
  font-weight: 700;
  color: var(--color-brand-700);
`;

const SkeletonCard = styled.div`
  background: linear-gradient(
    90deg,
    var(--color-grey-100) 25%,
    var(--color-grey-50) 50%,
    var(--color-grey-100) 75%
  );
  background-size: 800px 100%;
  animation: ${shimmer} 1.4s infinite linear;
  border-radius: var(--border-radius-md);
  height: 8.4rem;
`;

const Actions = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
  gap: 1rem;
`;

const ActionCard = styled.div`
  border: 1px solid var(--color-grey-200);
  border-top: 3px solid ${(p) =>
    p.$accent === "gold"
      ? "var(--color-gold-700)"
      : p.$accent === "green"
      ? "var(--color-gov-green-700)"
      : "var(--color-brand-600)"};
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

  const stats = [
    { label: "Semestres activos", value: semesters?.length, loading: loadingSem, icon: <FaCalendar size={22} />, theme: "gold" },
    { label: "Trabajadores", value: workers?.length, loading: loadingWorkers, icon: <HiOutlineUsers size={22} />, theme: "brand" },
    { label: "Asignaturas", value: subjects?.length, loading: loadingSubjects, icon: <HiBookOpen size={22} />, theme: "green" },
    { label: "Grupos", value: groups?.length, loading: loadingGroups, icon: <HiAcademicCap size={22} />, theme: "green" },
  ];

  return (
    <>
      <Row type="vertical">
        <Heading as="h1">Panel general</Heading>
        <p style={{ color: "var(--color-grey-600)" }}>
          Un vistazo rápido a los datos clave y accesos directos.
        </p>
      </Row>

      <Grid>
        {stats.map(({ label, value, loading, icon, theme }) =>
          loading ? (
            <SkeletonCard key={label} />
          ) : (
            <StatCard key={label}>
              <StatIcon $theme={theme}>{icon}</StatIcon>
              <StatContent>
                <StatLabel>{label}</StatLabel>
                <StatValue>{value ?? 0}</StatValue>
              </StatContent>
            </StatCard>
          )
        )}
      </Grid>

      <Actions>
        <ActionCard $accent="gold">
          <ActionTitle>Administrar horarios</ActionTitle>
          <ActionText>
            Ingresa a los semestres para gestionar horarios escolares y de
            docentes.
          </ActionText>
          <Button as={Link} to="/semesters">
            Ir a semestres
          </Button>
        </ActionCard>

        <ActionCard $accent="green">
          <ActionTitle>Registrar asignaturas</ActionTitle>
          <ActionText>
            Alta y edición de materias, su semestre y programa académico.
          </ActionText>
          <Button as={Link} to="/subjects" variation="secondary">
            Ver asignaturas
          </Button>
        </ActionCard>

        <ActionCard $accent="brand">
          <ActionTitle>Gestionar trabajadores</ActionTitle>
          <ActionText>
            Revisa el padrón de maestros y personal, y sus roles asignados.
          </ActionText>
          <Button as={Link} to="/workers" variation="secondary">
            Ver trabajadores
          </Button>
        </ActionCard>

        <ActionCard $accent="green">
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
