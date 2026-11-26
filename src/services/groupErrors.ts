const messages: Record<string, string> = {
  GRP01: "El grupo cambió mientras lo consultabas. Actualiza la información antes de continuar.",
  GRP02: "El grupo tiene horarios asociados. Su identidad y eliminación están protegidas.",
  GRP03: "El estado del grupo no permite esta operación. Actualiza la información.",
  GRP04: "El grupo ya no existe. Actualiza la información.",
  GRP05: "Los datos del grupo no son válidos.",
  GRP06: "No se pudo realizar la operación con el aislamiento requerido.",
  "23505": "Ya existe un grupo con el mismo año de admisión, letra y licenciatura.",
  "23503": "La operación está bloqueada por registros relacionados o una referencia inválida.",
  "42501": "No tienes permisos para realizar esta operación.",
  "23502": "Faltan datos obligatorios del grupo.",
  "23514": "Los datos no cumplen las restricciones del grupo.",
  "40001": "Hubo un conflicto simultáneo. Actualiza la información antes de volver a intentar.",
  "40P01": "Hubo un conflicto simultáneo. Actualiza la información antes de volver a intentar.",
};

export function groupMutationError(error: { code?: string } | null | undefined): Error {
  const code = error?.code ?? "";
  if (Object.prototype.hasOwnProperty.call(messages, code)) return new Error(messages[code]);
  if (!code || code.startsWith("08") || code.startsWith("PGRST")) {
    return new Error("No se pudo confirmar el resultado. Actualiza la lista antes de volver a intentar.");
  }
  return new Error("No se pudo completar la operación del grupo. Actualiza la información antes de reintentar.");
}
