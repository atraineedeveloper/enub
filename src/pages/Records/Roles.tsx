import RoleTable from "../../features/roles/RoleTable";
import Heading from "../../ui/Heading";
import Row from "../../ui/Row";

function Roles() {
  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">Roles Escolares</Heading>
      </Row>
      <Row>
        <RoleTable />
      </Row>
    </>
  );
}

export default Roles;
