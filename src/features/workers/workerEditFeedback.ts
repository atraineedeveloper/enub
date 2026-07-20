export const WORKER_EDIT_SUCCESS_MESSAGE =
  "El registro se actualizó con éxito";
export const WORKER_EDIT_FALLBACK_ERROR_MESSAGE =
  "No se pudo actualizar el trabajador. No se guardó ningún cambio.";

export function handleWorkerEditSuccess(
  notifySuccess: (message: string) => void,
  invalidateWorkers: () => void
) {
  notifySuccess(WORKER_EDIT_SUCCESS_MESSAGE);
  invalidateWorkers();
}

export function handleWorkerEditError(
  error: unknown,
  notifyError: (message: string) => void
) {
  notifyError(
    error instanceof Error && error.message
      ? error.message
      : WORKER_EDIT_FALLBACK_ERROR_MESSAGE
  );
}
