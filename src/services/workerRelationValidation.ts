import type { DateOfAdmissionInput, SustenancePlazaInput } from "../types/workerMutation";

export function validateWorkerRelations(plazas?: SustenancePlazaInput[], admissions?: DateOfAdmissionInput[]) {
  const keys = new Set<string>();
  for (const row of plazas ?? []) {
    const sustenance = row.sustenance?.trim() ?? "";
    const key = row.payment_key?.trim() ?? "";
    const plaza = row.plaza?.trim() ?? "";
    if (!sustenance && !key && !plaza) continue;
    if (!sustenance || !key || !plaza) throw new Error("Cada plaza debe tener sostenimiento, clave de pago y plaza");
    if (!["estatal", "federal"].includes(sustenance.toLowerCase())) throw new Error("El sostenimiento debe ser Estatal o Federal");
    if (keys.has(key)) throw new Error("Hay claves de pago repetidas en las plazas del trabajador");
    keys.add(key);
  }
  const types = new Set<string>();
  const normalizedAdmissions = admissions?.flatMap(row => {
    const type = row.type?.trim() ?? "";
    const date = row.date_of_admission?.trim() ?? "";
    if (!type && !date) return [];
    if (!type || !date) throw new Error("Cada admisión debe tener tipo y fecha");
    const parsed = new Date(date + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date.startsWith("0000")) throw new Error("La fecha de admisión no es válida");
    const key = type.toUpperCase();
    if (types.has(key)) throw new Error("Hay tipos de admisión repetidos");
    types.add(key);
    return [{ type, date_of_admission: date }];
  });
  return normalizedAdmissions;
}
