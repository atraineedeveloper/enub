import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { uploadWorkerDocument } from "../../../services/apiWorkerDocuments";
import { invalidateWorkerDocumentQueries } from "./workerDocumentKeys";

export function useUploadWorkerDocument() {
  const queryClient = useQueryClient();

  const { mutate: uploadDocument, isPending: isUploading } = useMutation({
    mutationFn: uploadWorkerDocument,
    onSuccess: (document) => {
      toast.success("El documento se subió con éxito");
      invalidateWorkerDocumentQueries(queryClient, document?.worker_id);
    },
    onError: (err) => toast.error(err.message),
  });

  return { isUploading, uploadDocument };
}
