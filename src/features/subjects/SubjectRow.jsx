import Table from "../../ui/Table";
import Button from "../../ui/Button";

function SubjectRow({ subject }) {
  const {
    semester,
    name,
    credits,
    hours_per_week,
    hours_per_semester,
    degrees,
    study_programs,
  } = subject;

  return (
    <>
      <Table.Row>
        <p>{semester}</p>
        <p>{name.toUpperCase()}</p>
        <p>{credits}</p>
        <p>{hours_per_week}</p>
        <p>{hours_per_semester}</p>
        <p>{study_programs.year}</p>
        <p>{degrees.code}</p>
        <Button size="medium" variation="primary">
          Editar
        </Button>
      </Table.Row>
    </>
  );
}

export default SubjectRow;
