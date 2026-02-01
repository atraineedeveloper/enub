import Heading from "../../ui/Heading";
import Row from "../../ui/Row";
import OtherTable from "../../features/otherData/OtherTable";

function Others() {
  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">Otros datos</Heading>
      </Row>
      <Row>
        <OtherTable />
      </Row>
    </>
  );
}

export default Others;
