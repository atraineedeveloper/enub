import StudyProgramsTable from "../../features/studyPrograms/StudyProgramsTable";
import Heading from "../../ui/Heading";
import Row from "../../ui/Row";

function StudyPrograms() {
  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">Lista de planes de estudio</Heading>
        <p>Consulta los planes de estudio registrados.</p>
      </Row>
      <Row>
        <StudyProgramsTable />
      </Row>
    </>
  );
}

export default StudyPrograms;
