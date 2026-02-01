import Spinner from "../../ui/Spinner";
import SubjectRow from "./SubjectRow";
import { useSubjects } from "./useSubjects";
import Table from "../../ui/Table";

function SubjectTable() {
  const { isLoading, subjects } = useSubjects();

  if (isLoading) return <Spinner />;

  return (
    <Table columns="1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr">
      <Table.Header>
        <div>Semestre</div>
        <div>Nombre</div>
        <div>Créditos</div>
        <div>Horas por semana</div>
        <div>Horas por semestre</div>
        <div>Programa de estudio</div>
        <div>Licenciatura</div>
        <div></div>
      </Table.Header>
      <Table.Body
        data={subjects || []}
        render={(subject: any) => <SubjectRow subject={subject} key={subject.id} />}
      />
    </Table>
  );
}

export default SubjectTable;
