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
  log("Supabase worker update failed", getSupabaseErrorDiagnostic(error));
  return new Error(WORKER_UPDATE_ERROR_MESSAGE, { cause: error });
}
