import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { replaceWorkerDocument } from "../../../services/apiWorkerDocuments";
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
      onSuccess: (document) => {
        // storageCleanupFailed is a distinct outcome, not a plain failure --
        // the replacement itself already committed successfully (the new
        // metadata and file are in place); only removing the now-superseded
        // storage object failed, so this is a separate, distinguishable
        // toast rather than reusing the plain success message or throwing.
        if (document?.storageCleanupFailed) {
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
