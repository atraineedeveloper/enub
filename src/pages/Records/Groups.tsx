import { useState } from "react";
import GroupTable from "../../features/groups/GroupTable";
import Button from "../../ui/Button";
import Heading from "../../ui/Heading";
import Row from "../../ui/Row";
import CreateGroupForm from "../../features/groups/CreateGroupForm";
import { useProfile } from "../../features/authentication/useProfile";

function Groups() {
  const { isStaffOrAdmin } = useProfile();
  const [showFormGroup, setShowFormGroup] = useState(false);
  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">Grupos Escolares</Heading>
        {isStaffOrAdmin && <Button onClick={() => setShowFormGroup(!showFormGroup)}>
          Agregar grupo
        </Button>}
      </Row>
      {isStaffOrAdmin && showFormGroup && <CreateGroupForm />}
      <Row>
        <GroupTable />
      </Row>
    </>
  );
}

export default Groups;
