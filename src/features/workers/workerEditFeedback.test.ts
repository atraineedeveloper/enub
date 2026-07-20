import { describe, expect, mock, test } from "bun:test";
import {
  handleWorkerEditError,
  handleWorkerEditSuccess,
  WORKER_EDIT_FALLBACK_ERROR_MESSAGE,
  WORKER_EDIT_SUCCESS_MESSAGE,
} from "./workerEditFeedback";

describe("worker edit feedback", () => {
  test("complete success shows success and invalidates workers", () => {
    const notifySuccess = mock(() => undefined);
    const invalidateWorkers = mock(() => undefined);

    handleWorkerEditSuccess(notifySuccess, invalidateWorkers);

    expect(notifySuccess).toHaveBeenCalledWith(WORKER_EDIT_SUCCESS_MESSAGE);
    expect(invalidateWorkers).toHaveBeenCalledTimes(1);
  });

  test("a transactional failure shows its safe useful message, never success", () => {
    const notifyError = mock(() => undefined);
    const notifySuccess = mock(() => undefined);
    const error = new Error(
      "No se pudo actualizar el trabajador. No se guardó ningún cambio."
    );

    handleWorkerEditError(error, notifyError);

    expect(notifyError).toHaveBeenCalledWith(error.message);
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  test("a non-Error rejection uses a safe fallback", () => {
    const notifyError = mock(() => undefined);

    handleWorkerEditError({ sensitive: "database detail" }, notifyError);

    expect(notifyError).toHaveBeenCalledWith(
      WORKER_EDIT_FALLBACK_ERROR_MESSAGE
    );
  });
});
