import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { uploadWorkerDocument } from "../../../services/apiWorkerDocuments";
import { invalidateWorkerDocumentQueries } from "./workerDocumentKeys";
import type { WorkerDocument } from "./useWorkerDocuments";

interface UploadWorkerDocumentVariables {
  workerId: number;
  documentTypeId: number;
  semesterId?: number | string | null;
  file: File;
}

// uploadWorkerDocument is untyped JS (out of scope) whose parameter is
// destructured with a per-property default (`semesterId = null`), so TS's
// allowJs inference narrows that property to `null` alone -- same class of
// friction as createEditWorkers's `options` param (Phase 2, useCreateWorker.ts).
// Cast at the call site rather than touching apiWorkerDocuments.js.
const uploadDocument = uploadWorkerDocument as (
  variables: UploadWorkerDocumentVariables
) => Promise<WorkerDocument>;

export function useUploadWorkerDocument() {
  const queryClient = useQueryClient();

  const { mutate: uploadDocumentMutate, isPending: isUploading } = useMutation(
    {
      mutationFn: uploadDocument,
      onSuccess: (document) => {
        toast.success("El documento se subió con éxito");
        invalidateWorkerDocumentQueries(queryClient, document?.worker_id);
      },
      onError: (err) => toast.error(err.message),
    }
  );

  return { isUploading, uploadDocument: uploadDocumentMutate };
}
