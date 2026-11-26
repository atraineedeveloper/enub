export type GroupIdentity = { year_of_admission: number; letter: string; degree_id: number };
export type GroupVersion = { id: number; version: number };

function positiveInteger(value: unknown, label: string, max = Number.MAX_SAFE_INTEGER): number {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  if (!Number.isSafeInteger(n) || n <= 0 || n > max) throw new Error(label + " no válido.");
  return n;
}

export function validateGroupIdentity(input: object): GroupIdentity {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Los datos del grupo no son válidos.");
  const v = input as Record<string, unknown>;
  const letter = typeof v.letter === "string" ? v.letter.trim().toUpperCase() : "";
  if (!letter) throw new Error("La letra del grupo es obligatoria.");
  return {
    year_of_admission: positiveInteger(v.year_of_admission, "Año de admisión", 2147483647),
    letter,
    degree_id: positiveInteger(v.degree_id, "Identificador de licenciatura"),
  };
}

export function validateGroupVersion(value: GroupVersion): GroupVersion {
  return { id: positiveInteger(value.id, "Identificador del grupo"), version: positiveInteger(value.version, "Versión", 2147483647) };
}

export function validateGroupReason(value: unknown): string {
  const reason = typeof value === "string" ? value.trim() : "";
  if (!reason || Array.from(reason).length > 500) throw new Error("Escribe un motivo de 1 a 500 caracteres.");
  return reason;
}
