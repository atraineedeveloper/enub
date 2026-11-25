interface SupabaseErrorDetails {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

type DiagnosticLogger = (message: string, diagnostic: SupabaseErrorDetails) => void;

export const WORKER_UPDATE_ERROR_MESSAGE =
  "No se pudo actualizar el trabajador. No se guardó ningún cambio. Revisa las plazas y fechas de admisión e intenta de nuevo.";

export function getSupabaseErrorDiagnostic(error: SupabaseErrorDetails) {
  return {
    code: error?.code ?? null,
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
  };
}

export function createWorkerUpdateError(
  error: SupabaseErrorDetails,
  log: DiagnosticLogger = console.error
) {
  // Avoid logging database details which can contain worker data.
  log("Supabase worker update failed", { code: error?.code ?? null });
  let message = WORKER_UPDATE_ERROR_MESSAGE;
  if (error?.code === "23505") {
    message = "Conflicto de identificadores o datos duplicados. Contacta al administrador; la actualización fue rechazada.";
  } else if (error?.code === "42501" || error?.code === "WUP01") {
    message = "No tienes permisos para actualizar este trabajador.";
  } else if (!error?.code || error.code.startsWith("08") || error.code.startsWith("PGRST")) {
    message = "No se pudo confirmar el resultado. Verifica el expediente antes de volver a guardar.";
  }
  return new Error(message, { cause: error });
}
