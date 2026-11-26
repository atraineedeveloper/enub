import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Button from "../../ui/Button";
import Heading from "../../ui/Heading";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Row from "../../ui/Row";
import { useDegrees } from "../degrees/useDegrees";
import { archiveGroup, restoreGroup, deleteGroup, updateGroup } from "../../services/apiGroups";
import type { Group } from "./useGroups";

export type GroupAction = "edit" | "archive" | "restore" | "delete";
const titles = { edit: "Editar grupo", archive: "Archivar grupo", restore: "Reactivar grupo", delete: "Eliminar grupo" };

export default function GroupActionForm({ group, action, onCloseModal }: { group: Group; action: GroupAction; onCloseModal?: () => void }) {
  const queryClient = useQueryClient();
  const { degrees, isLoading } = useDegrees();
  const [year, setYear] = useState(String(group.year_of_admission ?? ""));
  const [letter, setLetter] = useState(group.letter ?? "");
  const [degree, setDegree] = useState(String(group.degree_id ?? ""));
  const [initialVersion] = useState(group.version);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const mutation = useMutation({
    retry: false,
    mutationFn: async () => {
      const target = { id: group.id, version: initialVersion };
      if (action === "edit") return updateGroup(target, { year_of_admission: year, letter, degree_id: degree });
      if (action === "archive") return archiveGroup(target, reason);
      if (action === "restore") return restoreGroup(target, reason);
      return deleteGroup(target, reason);
    },
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["groups"] }), queryClient.invalidateQueries({ queryKey: ["group-audit"] })]);
      toast.success("Operación realizada correctamente.");
      onCloseModal?.();
    },
    onError: async (error) => {
      setFailed(true);
      toast.error(error.message);
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onSettled: () => { inFlight.current = false; },
  });
  const disabled = mutation.isPending || failed;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled || inFlight.current || (action === "delete" && !confirmed)) return;
    inFlight.current = true;
    mutation.mutate();
  }
  return (
    <form onSubmit={submit}>
      <Row>
        <Heading as="h3">{titles[action]}</Heading>
        <p>Generación {group.year_of_admission} · {group.letter} · {group.degrees?.code ?? "Sin licenciatura"}</p>
        {action === "edit" ? <>
          <label htmlFor="group-edit-year">Año de admisión</label>
          <Input id="group-edit-year" value={year} onChange={e => setYear(e.target.value)} required disabled={disabled} inputMode="numeric" />
          <label htmlFor="group-edit-letter">Letra</label>
          <Input id="group-edit-letter" value={letter} onChange={e => setLetter(e.target.value)} required disabled={disabled} />
          <label htmlFor="group-edit-degree">Licenciatura</label>
          <Select id="group-edit-degree" value={degree} onChange={e => setDegree(e.target.value)} required disabled={disabled || isLoading}>
            <option value="">Seleccione</option>
            {(degrees ?? []).map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
          </Select>
          <p>La base de datos rechazará cambios de identidad si existen horarios asociados.</p>
        </> : <>
          <p>{action === "archive" ? "Se conservarán los horarios históricos; no se permitirán nuevas asignaciones." : action === "restore" ? "El grupo volverá a estar disponible para nuevas asignaciones." : "La eliminación es definitiva y solo es posible si no hay horarios asociados."}</p>
          <label htmlFor="group-action-reason">Motivo administrativo</label>
          <textarea id="group-action-reason" value={reason} onChange={e => setReason(e.target.value)} required maxLength={500} disabled={disabled} rows={3} />
          {action === "delete" && <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={disabled} /> Confirmo la eliminación definitiva</label>}
        </>}
        {failed && <p role="alert">{mutation.error?.message} Cierra esta ventana y revisa el registro actualizado.</p>}
        <Row type="horizontal">
          <Button type="button" variation="secondary" disabled={mutation.isPending} onClick={onCloseModal}>Cancelar</Button>
          <Button type="submit" variation={action === "delete" ? "danger" : "primary"} disabled={disabled || (action === "delete" && !confirmed) || (action === "edit" && isLoading)}>{mutation.isPending ? "Guardando…" : titles[action]}</Button>
        </Row>
      </Row>
    </form>
  );
}
