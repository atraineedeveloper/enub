import styled from "styled-components";
import Button from "../../ui/Button";
import { Link } from "react-router-dom";
import { FaCalendar } from "react-icons/fa";

const Card = styled.div`
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  padding: 2rem 2.4rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  transition: box-shadow 0.2s ease, transform 0.2s ease;

  &:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 1.2rem;
`;

const IconBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  border-radius: var(--border-radius-md);
  background-color: var(--color-brand-50);
  color: var(--color-brand-600);
  flex-shrink: 0;
`;

const SemesterCode = styled.h3`
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-grey-800);
`;

const SchoolYear = styled.p`
  font-size: 1.3rem;
  color: var(--color-grey-500);
`;

function SemesterRow({ semester }) {
  const { semester: semesterRecord, school_year, id } = semester;
  return (
    <Card>
      <CardHeader>
        <IconBox>
          <FaCalendar size={18} />
        </IconBox>
        <div>
          <SemesterCode>{semesterRecord}</SemesterCode>
          <SchoolYear>{school_year}</SchoolYear>
        </div>
      </CardHeader>
      <Button as={Link} to={`/semesters/${id}`}>
        Administrar
      </Button>
    </Card>
  );
}

export default SemesterRow;
