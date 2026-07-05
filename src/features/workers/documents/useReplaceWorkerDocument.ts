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

// Same untyped-destructured-default friction as useUploadWorkerDocument.ts --
// see that file's comment.
const replaceDocument = replaceWorkerDocument as (
  variables: ReplaceWorkerDocumentVariables
) => Promise<WorkerDocument>;

export function useReplaceWorkerDocument() {
  const queryClient = useQueryClient();

  const { mutate: replaceDocumentMutate, isPending: isReplacing } =
    useMutation({
      mutationFn: replaceDocument,
      onSuccess: (document) => {
        toast.success("El documento se reemplazó con éxito");
        invalidateWorkerDocumentQueries(queryClient, document?.worker_id);
      },
      onError: (err) => toast.error(err.message),
    });

  return { isReplacing, replaceDocument: replaceDocumentMutate };
}
