import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { deleteWorkerDocument } from "../../../services/apiWorkerDocuments";
import {
  reconcileWorkerDocumentStorage,
  reconciliationClearedPendingCleanup,
} from "../../../services/apiWorkerDocumentReconciliation";
import { invalidateWorkerDocumentQueries } from "./workerDocumentKeys";

export function useDeleteWorkerDocument() {
  const queryClient = useQueryClient();

  const { mutate: deleteDocument, isPending: isDeleting } = useMutation({
    mutationFn: deleteWorkerDocument,
    onSuccess: async (result) => {
      let storageCleanupFailed = Boolean(result?.storageCleanupFailed);

      if (result?.workerId) {
        if (storageCleanupFailed) {
          // The browser's immediate Storage removal failed. Give the
          // server-side reconciler one chance to process the durable queue
          // before warning the user. If reconciliation cannot prove the
          // whole pending batch clean, keep the conservative warning.
          try {
            const reconciliation = await reconcileWorkerDocumentStorage(
              result.workerId
            );
            if (reconciliationClearedPendingCleanup(reconciliation)) {
              storageCleanupFailed = false;
            }
          } catch (error) {
            console.error(error);
          }
        } else {
          // Immediate cleanup already succeeded, so reconciliation is only
          // an acknowledgement/maintenance step. Never turn a clean user
          // operation into an error if the new function is temporarily
          // unavailable during rollout.
          void reconcileWorkerDocumentStorage(result.workerId).catch((error) =>
            console.error(error)
          );
        }
      }

      if (storageCleanupFailed) {
        toast.error(
          "El documento se eliminó del expediente, pero el archivo podría necesitar limpieza adicional; contacta a soporte si esto se repite"
        );
      } else {
        toast.success("El documento se eliminó con éxito");
      }

      invalidateWorkerDocumentQueries(queryClient, result?.workerId);
    },
    onError: (err) => toast.error(err.message),
  });

  return { isDeleting, deleteDocument };
}
