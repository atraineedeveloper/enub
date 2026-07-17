// Exact, final label/fallback text for the read-only "Mi información" page
// (design.md §10). Pure, individually-tested mapping functions -- no
// component reaches into raw `status`/field values directly.

export const STATUS_ACTIVE_LABEL = "Activo";
export const STATUS_INACTIVE_LABEL = "Inactivo";
export const STATUS_UNKNOWN_LABEL = "Estado desconocido";
export const NOT_ON_FILE_LABEL = "No registrado";
export const WORKER_TYPE_UNSPECIFIED_LABEL = "Tipo no especificado";

/**
 * Exactly: 1 -> "Activo", 0 -> "Inactivo", anything else (including null,
 * undefined, or a non-numeric/malformed value) -> "Estado desconocido".
 * Never guesses Activo/Inactivo for an unrecognized value -- matches
 * WorkerRow.tsx's existing `status === 1 ? "Activo" : "Inactivo"` for the
 * two known cases, but adds the explicit third state that component never
 * needed (an admin-authored row is always 0/1 in practice; a worker's own
 * self-service view can't assume that).
 */
export function translateWorkerStatus(
  status: number | null | undefined
): string {
  if (status === 1) return STATUS_ACTIVE_LABEL;
  if (status === 0) return STATUS_INACTIVE_LABEL;
  return STATUS_UNKNOWN_LABEL;
}

/** Missing/empty email, phone, specialty, or function_performed -> "No registrado". */
export function formatOptionalWorkerField(
  value: string | null | undefined
): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : NOT_ON_FILE_LABEL;
}

/** Missing/empty type_worker -> the distinct "Tipo no especificado" text. */
export function formatWorkerType(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : WORKER_TYPE_UNSPECIFIED_LABEL;
}
