import { useState } from "react";
import GroupTable from "../../features/groups/GroupTable";
import Button from "../../ui/Button";
import Heading from "../../ui/Heading";
import Row from "../../ui/Row";
import CreateGroupForm from "../../features/groups/CreateGroupForm";

function Groups() {
  const [showFormGroup, setShowFormGroup] = useState(false);
  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">Grupos Escolares</Heading>
        <Button onClick={() => setShowFormGroup(!showFormGroup)}>
          Agregar grupo
        </Button>
      </Row>
      {showFormGroup && <CreateGroupForm />}
      <Row>
        <GroupTable />
      </Row>
    </>
  );
}

export default Groups;
