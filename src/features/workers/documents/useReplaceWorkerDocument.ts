import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { replaceWorkerDocument } from "../../../services/apiWorkerDocuments";
import {
  reconcileWorkerDocumentStorage,
  reconciliationClearedPendingCleanup,
} from "../../../services/apiWorkerDocumentReconciliation";
import { invalidateWorkerDocumentQueries } from "./workerDocumentKeys";
import type { WorkerDocument } from "./useWorkerDocuments";

interface ReplaceWorkerDocumentVariables {
  workerId: number;
  documentTypeId: number;
  semesterId?: number | string | null;
  file: File;
}

type ReplaceWorkerDocumentResult = WorkerDocument & {
  storageCleanupFailed: boolean;
};

// Same untyped-destructured-default friction as useUploadWorkerDocument.ts --
// see that file's comment.
const replaceDocument = replaceWorkerDocument as (
  variables: ReplaceWorkerDocumentVariables
) => Promise<ReplaceWorkerDocumentResult>;

export function useReplaceWorkerDocument() {
  const queryClient = useQueryClient();

  const { mutate: replaceDocumentMutate, isPending: isReplacing } =
    useMutation({
      mutationFn: replaceDocument,
      onSuccess: async (document) => {
        let storageCleanupFailed = Boolean(document?.storageCleanupFailed);

        if (document?.worker_id) {
          if (storageCleanupFailed) {
            try {
              const reconciliation = await reconcileWorkerDocumentStorage(
                document.worker_id
              );
              if (reconciliationClearedPendingCleanup(reconciliation)) {
                storageCleanupFailed = false;
              }
            } catch (error) {
              console.error(error);
            }
          } else {
            void reconcileWorkerDocumentStorage(document.worker_id).catch(
              (error) => console.error(error)
            );
          }
        }

        if (storageCleanupFailed) {
          toast.error(
            "El documento se reemplazó con éxito, pero el archivo anterior podría necesitar limpieza adicional; contacta a soporte si esto se repite"
          );
        } else {
          toast.success("El documento se reemplazó con éxito");
        }

        invalidateWorkerDocumentQueries(queryClient, document?.worker_id);
      },
      onError: (err) => toast.error(err.message),
    });

  return { isReplacing, replaceDocument: replaceDocumentMutate };
}
