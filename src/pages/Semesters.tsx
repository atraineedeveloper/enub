import SemesterTable from "../features/semesters/SemesterTable";
import Heading from "../ui/Heading";
import Row from "../ui/Row";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import CreateSemesterForm from "../features/semesters/CreateSemesterForm";
import Breadcrumbs from "../ui/Breadcrumbs";

function Semesters() {
  const breadcrumbItems = [{ label: "Administrar horarios" }];

  return (
    <>
      <Breadcrumbs items={breadcrumbItems} />
      <Row type="horizontal">
        <Heading as="h1">Semestres Escolares</Heading>
        <Modal>
          <Modal.Open opens="create-semester">
            <Button>Agregar semestre</Button>
          </Modal.Open>
          <Modal.Window name="create-semester">
            <CreateSemesterForm />
          </Modal.Window>
        </Modal>
      </Row>
      <Row>
        <SemesterTable />
      </Row>
    </>
  );
}

export default Semesters;
