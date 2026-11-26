import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getGroupAudit } from "../../services/apiGroups";
import { useUser } from "../authentication/useUser";
import { useProfile } from "../authentication/useProfile";
import Button from "../../ui/Button";
import Heading from "../../ui/Heading";
import Row from "../../ui/Row";
import Spinner from "../../ui/Spinner";
import ErrorMessage from "../../ui/ErrorMessage";

const PAGE_SIZE = 25;
const labels: Record<string, string> = {
  create: "Creación", edit: "Edición", archive: "Archivado",
  reactivate: "Reactivación", delete: "Eliminación",
};

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("es-MX");
}

function AuditPage({ userId }: { userId: string }) {
  const [cursors, setCursors] = useState<(number | undefined)[]>([undefined]);
  const before = cursors[cursors.length - 1];
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["group-audit", userId, before ?? null],
    queryFn: () => getGroupAudit(undefined, before, PAGE_SIZE + 1),
    retry: false,
    staleTime: 0,
  });
  const rows = (data ?? []).slice(0, PAGE_SIZE);
  return (
    <Row>
      <Row type="horizontal">
        <Heading as="h2">Historial administrativo de grupos</Heading>
        <Button variation="secondary" onClick={() => void refetch()}>Actualizar</Button>
      </Row>
      <p>Registro de cambios de solo lectura. Los eventos de grupos eliminados también se conservan.</p>
      {isLoading ? <Spinner /> : error ? <ErrorMessage message={error.message} /> : rows.length === 0 ? <p>No hay eventos registrados en esta página.</p> :
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <caption>Eventos administrativos recientes</caption>
            <thead><tr>{["Fecha", "Grupo", "Operación", "Responsable", "Motivo", "Cambios"].map(label => <th key={label} scope="col" style={{ padding: "0.8rem" }}>{label}</th>)}</tr></thead>
            <tbody>{rows.map(event => <tr key={event.id}>
              <td style={{ padding: "0.8rem" }}>{displayDate(event.occurred_at)}</td>
              <td style={{ padding: "0.8rem" }}>#{event.group_id}</td>
              <td style={{ padding: "0.8rem" }}>{labels[event.action] ?? event.action}</td>
              <td style={{ padding: "0.8rem", overflowWrap: "anywhere" }}>{event.actor_id}</td>
              <td style={{ padding: "0.8rem", overflowWrap: "anywhere" }}>{event.reason ?? "—"}</td>
              <td style={{ padding: "0.8rem" }}><details><summary>Ver cambios</summary>
                <p>Antes</p><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(event.before_state, null, 2)}</pre>
                <p>Después</p><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(event.after_state, null, 2)}</pre>
              </details></td>
            </tr>)}</tbody>
          </table>
        </div>}
      <Row type="horizontal">
        <Button variation="secondary" disabled={cursors.length <= 1 || isLoading} onClick={() => setCursors(previous => previous.slice(0, -1))}>Anterior</Button>
        <span>Página {cursors.length}</span>
        <Button variation="secondary" disabled={isLoading || (data?.length ?? 0) <= PAGE_SIZE} onClick={() => { if (rows.length) setCursors(previous => [...previous, rows[rows.length - 1].id]); }}>Siguiente</Button>
      </Row>
    </Row>
  );
}

export default function GroupAudit() {
  const { user, isAuthenticated } = useUser();
  const { isAdmin } = useProfile();
  if (!isAuthenticated || !isAdmin || !user?.id) return null;
  return <AuditPage key={user.id} userId={user.id} />;
}
