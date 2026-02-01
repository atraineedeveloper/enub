import SubjectTable from "../../features/subjects/SubjectTable";
import Heading from "../../ui/Heading";
import Row from "../../ui/Row";

function Subjects() {
  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">Lista de asignaturas</Heading>
        <p>Placeholder</p>
      </Row>
      <Row>
        <SubjectTable />
      </Row>
    </>
  );
}

export default Subjects;
