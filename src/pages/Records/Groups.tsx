import { useState } from "react";
import GroupTable from "../../features/groups/GroupTable";
import Button from "../../ui/Button";
import Heading from "../../ui/Heading";
import Row from "../../ui/Row";
import CreateGroupForm from "../../features/groups/CreateGroupForm";
import GroupAudit from "../../features/groups/GroupAudit";
import { useProfile } from "../../features/authentication/useProfile";

function Groups() {
  const { isStaffOrAdmin, isAdmin } = useProfile();
  const [showAudit, setShowAudit] = useState(false);
  const [showFormGroup, setShowFormGroup] = useState(false);
  return (
    <>
      <Row type="horizontal">
        <Heading as="h1">Grupos Escolares</Heading>
        {isStaffOrAdmin && <Button onClick={() => setShowFormGroup(!showFormGroup)}>
          Agregar grupo
        </Button>}
        {isAdmin && <Button variation="secondary" onClick={() => setShowAudit(v => !v)}>{showAudit ? "Ocultar historial" : "Consultar historial"}</Button>}
      </Row>
      {isAdmin && showAudit && <GroupAudit />}
      {isStaffOrAdmin && showFormGroup && <CreateGroupForm />}
      <Row>
        <GroupTable />
      </Row>
    </>
  );
}

export default Groups;
