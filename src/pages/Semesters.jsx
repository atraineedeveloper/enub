import SemesterTable from "../features/semesters/SemesterTable";
import Heading from "../ui/Heading";
import Row from "../ui/Row";
import Button from "../ui/Button";
import { useState } from "react";
import CreateSemesterForm from "../features/semesters/CreateSemesterForm";
import Breadcrumbs from "../ui/Breadcrumbs";

function Semesters() {
  const [showForm, setShowForm] = useState(false);

  const breadcrumbItems = [{ label: "Administrar horarios" }];

  return (
    <>
      <Breadcrumbs items={breadcrumbItems} />
      <Row type="horizontal">
        <Heading as="h1">Semestres Escolares</Heading>
        <Button onClick={() => setShowForm((show) => !show)}>
          Agregar semestre
        </Button>
      </Row>
      {showForm && <CreateSemesterForm />}
      <Row>
        <SemesterTable />
      </Row>
    </>
  );
}

export default Semesters;
