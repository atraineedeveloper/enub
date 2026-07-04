import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { deleteWorkerDocument } from "../../../services/apiWorkerDocuments";
import { invalidateWorkerDocumentQueries } from "./workerDocumentKeys";

export function useDeleteWorkerDocument() {
  const queryClient = useQueryClient();

  const { mutate: deleteDocument, isPending: isDeleting } = useMutation({
    mutationFn: deleteWorkerDocument,
    onSuccess: (result) => {
      // storageCleanupFailed is a distinct outcome, not a plain failure --
      // the document is already correctly gone from the expediente
      // (worker-documents-ux-and-delete decisions.md #3), so this is a
      // separate, distinguishable toast rather than reusing the plain
      // success message or throwing.
      if (result?.storageCleanupFailed) {
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
