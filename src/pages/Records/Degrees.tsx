import DegreeTable from "../../features/degrees/DegreeTable";
import Heading from "../../ui/Heading";
import Row from "../../ui/Row";

function Degrees() {
  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">Licenciaturas</Heading>
        <p>Placeholder</p>
      </Row>
      <Row>
        <DegreeTable />
      </Row>
    </>
  );
}

export default Degrees;
