import type { SustenancePlazaInput, DateOfAdmissionInput } from "../../types/workerMutation";

interface DirtyRelationFields {
  sustenance_plazas?: unknown;
  date_of_admissions?: unknown;
}

interface WorkerEditRelationValues {
  sustenance_plazas?: SustenancePlazaInput[];
  date_of_admissions?: DateOfAdmissionInput[];
}

export function selectChangedWorkerRelations(
  dirtyFields: DirtyRelationFields,
  values: WorkerEditRelationValues
) {
  const sustenancePlazas = dirtyFields.sustenance_plazas
    ? values.sustenance_plazas ?? []
    : undefined;
  const dateOfAdmissions = dirtyFields.date_of_admissions
    ? (values.date_of_admissions ?? []).filter(
        (date) => date.type || date.date_of_admission
      )
    : undefined;

  return { sustenancePlazas, dateOfAdmissions };
}
