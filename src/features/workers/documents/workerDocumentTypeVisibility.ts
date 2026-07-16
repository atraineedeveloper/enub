import type { WorkerDocumentType } from "./useWorkerDocumentCatalog";
import type { WorkerDocument } from "./useWorkerDocuments";

// The union rule (design.md Decision 7 / spec.md "Upload interfaces include
// a document type..."): a document type is visible for a given worker only
// when it is active, or that same worker already has at least one document
// under it. `documentsByType` must already be scoped to the one worker being
// viewed -- this function never looks at any other worker's documents, so
// it cannot leak a retired type into a different worker's view by
// construction, not merely by convention.
export function isDocumentTypeVisibleForWorker(
  documentType: Pick<WorkerDocumentType, "id" | "is_active">,
  documentsByType: Map<number, WorkerDocument[]>
) {
  return (
    documentType.is_active || documentsByType.has(documentType.id)
  );
}

export function filterVisibleDocumentTypes<
  T extends Pick<WorkerDocumentType, "id" | "is_active">
>(documentTypes: T[], documentsByType: Map<number, WorkerDocument[]>) {
  return documentTypes.filter((documentType) =>
    isDocumentTypeVisibleForWorker(documentType, documentsByType)
  );
}
