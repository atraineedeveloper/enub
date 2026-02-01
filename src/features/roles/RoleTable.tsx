import styled from "styled-components";
import Spinner from "../../ui/Spinner";
import { useRoles } from "./useRoles";
import RoleRow from "./RoleRow";

const Table = styled.div`
  border: 1px solid var(--color-grey-200);

  font-size: 1.4rem;
  background-color: var(--color-grey-0);
  border-radius: 7px;
  overflow: hidden;
`;

const TableHeader = styled.header`
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  column-gap: 2.4rem;
  align-items: center;

  background-color: var(--color-grey-50);
  border-bottom: 1px solid var(--color-grey-100);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-weight: 600;
  color: var(--color-grey-600);
  padding: 1.6rem 2.4rem;
`;

function RoleTable() {
  const { isLoading, roles } = useRoles();

  if (isLoading) return <Spinner />;

  return (
    <Table role="table">
      <TableHeader role="row">
        <div>Rol</div>
        <div>Trabajador</div>
        <div></div>
      </TableHeader>
      {roles?.map((role: any) => (
        <RoleRow role={role} key={role.id} />
      ))}
    </Table>
  );
}

export default RoleTable;
