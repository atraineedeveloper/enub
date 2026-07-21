import { useRef, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { uploadWorkerDocument } from "../../../services/apiWorkerDocuments";
import { invalidateWorkerDocumentQueries } from "./workerDocumentKeys";
import type { WorkerDocument } from "./useWorkerDocuments";

export type UploadQueueItemStatus =
  | "preparado"
  | "subiendo"
  | "completado"
  | "error";

export interface UploadQueueItem {
  id: string;
  file: File;
  status: UploadQueueItemStatus;
  errorMessage?: string;
}

// Pure queue transforms -- no React involved, so each is directly unit
// testable (useUploadWorkerDocuments.test.ts), matching this codebase's
// established split of "pure resolver, thin hook wrapper" (see
// useCurrentIdentity.ts / useCurrentIdentity.test.ts).

export function buildQueueItem(file: File): UploadQueueItem {
  return { id: crypto.randomUUID(), file, status: "preparado" };
}

export function updateQueueItem(
  items: UploadQueueItem[],
  itemId: string,
  patch: Partial<UploadQueueItem>
): UploadQueueItem[] {
  return items.map((entry) =>
    entry.id === itemId ? { ...entry, ...patch } : entry
  );
}

export function removeQueueItem(
  items: UploadQueueItem[],
  itemId: string
): UploadQueueItem[] {
  return items.filter((entry) => entry.id !== itemId);
}

export function getPendingItems(items: UploadQueueItem[]): UploadQueueItem[] {
  return items.filter((item) => item.status === "preparado");
}

// What would actually be lost if the queue were discarded right now:
// "preparado" (never attempted) and "error" (attempted, failed --
// reintentable or discardable, the user hasn't resolved it either way).
// "completado" is deliberately excluded -- that file's upload already
// committed server-side (the real worker_documents row exists), so
// discarding the local queue entry loses nothing. "subiendo" never
// appears here in practice (isBusy already blocks any close/discard
// attempt outright while a batch is running), but is excluded on
// principle too: a file mid-upload is neither abandoned-and-losable nor
// already-safe, it's a transaction in progress that must not be
// interrupted, hence the separate isBusy block in getDrawerCloseGuard.
export function getDiscardableItems(items: UploadQueueItem[]): UploadQueueItem[] {
  return items.filter((item) => item.status === "preparado" || item.status === "error");
}

// Sweeps every "completado" entry out of the local queue -- called once a
// batch/retry settles. A completado entry is not "cleared" in the sense of
// losing data (the upload already committed and is reflected in the
// parent's `documents` list via the already-fired cache invalidation);
// this only removes it from the transient client-side queue so it stops
// counting toward anything (pending count, discardable count, the
// "N archivos seleccionados" footer text) once there is nothing left to
// do with it.
export function removeCompletedItems(items: UploadQueueItem[]): UploadQueueItem[] {
  return items.filter((item) => item.status !== "completado");
}

// A new batch (uploadQueuedFiles) or a single retry may only start when no
// other batch/retry is already in flight for this same card, and there is
// at least one item to actually act on -- the pure predicate the
// double-submit guard is built from ("doble clic no duplica la subida").
export function canStartUpload(
  isUploading: boolean,
  actionableCount: number
): boolean {
  return !isUploading && actionableCount > 0;
}

export interface BatchSummary {
  variant: "success" | "error" | "partial";
  message: string;
}

// Building the exact user-facing summary text is pure and fully
// enumerable: total success, total failure, or a mixed result -- never a
// false "all succeeded"/"all failed" claim for a partial batch (design.md:
// no false atomicity).
export function buildBatchSummary(
  successCount: number,
  errorCount: number
): BatchSummary {
  if (errorCount === 0) {
    return {
      variant: "success",
      message:
        successCount === 1
          ? "El documento se subió con éxito"
          : `Los ${successCount} archivos se subieron con éxito`,
    };
  }

  if (successCount === 0) {
    return {
      variant: "error",
      message:
        errorCount === 1
          ? "El documento no pudo subirse"
          : `No se pudo subir ninguno de los ${errorCount} archivos`,
    };
  }

  return {
    variant: "partial",
    message: `${successCount} de ${successCount + errorCount} archivos se subieron con éxito; ${errorCount} tuvieron un error`,
  };
}

export interface WorkerDocumentUploadContext {
  workerId: number;
  documentTypeId: number;
  semesterId?: number | string | null;
}

export type WorkerDocumentUploader = (variables: {
  workerId: number;
  documentTypeId: number;
  semesterId?: number | string | null;
  file: File;
}) => Promise<WorkerDocument | null | undefined>;

export interface UploadQueueRunResult {
  successCount: number;
  errorCount: number;
  lastSuccessfulWorkerId?: number;
}

// Sequentially uploads every "preparado" item via the injected `uploadFile`
// -- one file at a time, awaited in order, never parallel -- reporting
// each status transition through `onItemUpdate` as it happens so a caller
// can mirror it into UI state immediately. A failed file does not stop the
// loop: every remaining file is still attempted (a batch of 5 with one
// early failure still tries the other 4), and the two counts returned are
// the only source of truth for the final summary/toast -- there is no
// cross-file transaction here (Storage and Postgres are separate systems
// even for a single file, let alone N).
export async function runUploadQueue(
  items: UploadQueueItem[],
  context: WorkerDocumentUploadContext,
  uploadFile: WorkerDocumentUploader,
  onItemUpdate: (itemId: string, patch: Partial<UploadQueueItem>) => void
): Promise<UploadQueueRunResult> {
  const pending = getPendingItems(items);

  let successCount = 0;
  let errorCount = 0;
  let lastSuccessfulWorkerId: number | undefined;

  for (const item of pending) {
    onItemUpdate(item.id, { status: "subiendo", errorMessage: undefined });

    try {
      const document = await uploadFile({
        workerId: context.workerId,
        documentTypeId: context.documentTypeId,
        semesterId: context.semesterId,
        file: item.file,
      });
      onItemUpdate(item.id, { status: "completado" });
      successCount += 1;
      lastSuccessfulWorkerId = document?.worker_id ?? context.workerId;
    } catch (error) {
      onItemUpdate(item.id, {
        status: "error",
        errorMessage: (error as Error)?.message || "El archivo no pudo subirse",
      });
      errorCount += 1;
    }
  }

  return { successCount, errorCount, lastSuccessfulWorkerId };
}

function showBatchSummaryToast(summary: BatchSummary) {
  if (summary.variant === "success") toast.success(summary.message);
  else if (summary.variant === "error") toast.error(summary.message);
  else toast(summary.message);
}

function invalidateAfterBatch(
  queryClient: QueryClient,
  workerId: number,
  result: UploadQueueRunResult
) {
  if (result.successCount > 0) {
    invalidateWorkerDocumentQueries(
      queryClient,
      result.lastSuccessfulWorkerId ?? workerId
    );
  }
}

// uploadWorkerDocument is untyped-destructured-default JS-inference
// friction (see useUploadWorkerDocument.ts's own comment for the identical
// cast) -- its `semesterId = null` default narrows the inferred parameter
// type more than the real signature allows.
const uploadDocument = uploadWorkerDocument as WorkerDocumentUploader;

interface UseUploadWorkerDocumentsParams {
  workerId: number;
  documentTypeId: number;
  semesterId?: number | string | null;
}

// Batch upload orchestration for a single document-type card: `addFiles`
// only ever queues files locally (status "preparado"); `uploadQueuedFiles`
// calls runUploadQueue (which in turn calls the existing single-file
// uploadWorkerDocument service function once per queued file) -- not a new
// batch RPC. Cache invalidation fires exactly once, after the whole batch
// settles, not once per file, to avoid a refetch cascade. isUploading (and
// the isBatchInFlightRef double-submit guard) belong to one hook instance
// per document-type card, so uploading in one card never disables any
// other card's controls.
export function useUploadWorkerDocuments({
  workerId,
  documentTypeId,
  semesterId,
}: UseUploadWorkerDocumentsParams) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const isBatchInFlightRef = useRef(false);

  // File-type/size validation and queue-level dedup/max-count checks all
  // already happened in MultiFileDropzone before this is called -- these
  // files are trusted to be ready to queue as-is.
  function addFiles(files: File[]) {
    if (!files.length) return;
    setItems((current) => [...current, ...files.map(buildQueueItem)]);
  }

  function removeItem(itemId: string) {
    setItems((current) => removeQueueItem(current, itemId));
  }

  // Discards every local queue entry (preparado, error, AND completado) --
  // never touches already-uploaded documents server-side. A "completado"
  // entry only ever represents a file whose upload already committed (the
  // real worker_documents row exists and is reflected via the already-
  // invalidated query, i.e. the parent's `documents` list) -- clearing it
  // from this transient local queue loses no data. Guarded against
  // clearing mid-upload, matching every other mutating action here.
  function clearQueue() {
    if (isBatchInFlightRef.current) return;
    setItems([]);
  }

  function applyItemUpdate(itemId: string, patch: Partial<UploadQueueItem>) {
    setItems((current) => updateQueueItem(current, itemId, patch));
  }

  async function uploadQueuedFiles() {
    if (!canStartUpload(isBatchInFlightRef.current, getPendingItems(items).length)) {
      return;
    }

    isBatchInFlightRef.current = true;
    setIsUploading(true);

    const result = await runUploadQueue(
      items,
      { workerId, documentTypeId, semesterId },
      uploadDocument,
      applyItemUpdate
    );

    // Once the batch settles, "completado" entries are swept out
    // immediately -- a fully successful batch ends with an empty queue
    // (nothing left to discard, the close guard reports "allow"); a
    // partial success keeps only the "error" entries (still discardable/
    // retryable), never the ones that already succeeded.
    setItems((current) => removeCompletedItems(current));

    invalidateAfterBatch(queryClient, workerId, result);
    showBatchSummaryToast(
      buildBatchSummary(result.successCount, result.errorCount)
    );

    isBatchInFlightRef.current = false;
    setIsUploading(false);
  }

  async function retryItem(itemId: string) {
    const item = items.find((entry) => entry.id === itemId);
    const isRetryable = item?.status === "error";

    if (!canStartUpload(isBatchInFlightRef.current, isRetryable ? 1 : 0)) {
      return;
    }

    isBatchInFlightRef.current = true;
    setIsUploading(true);

    // Reuse runUploadQueue against an isolated 1-item array containing only
    // the retried item (re-marked "preparado") -- never the full `items`
    // array, which could contain other genuinely-still-pending items that
    // a retry must not also sweep up.
    const result = await runUploadQueue(
      [{ ...item!, status: "preparado" }],
      { workerId, documentTypeId, semesterId },
      uploadDocument,
      applyItemUpdate
    );

    // Same sweep as uploadQueuedFiles: a successful retry's item is now
    // "completado" and is removed from the queue immediately; a failed
    // retry's item stays "error", still discardable/retryable.
    setItems((current) => removeCompletedItems(current));

    if (result.successCount > 0) {
      invalidateAfterBatch(queryClient, workerId, result);
      toast.success("El documento se subió con éxito");
    }

    isBatchInFlightRef.current = false;
    setIsUploading(false);
  }

  return {
    items,
    isUploading,
    addFiles,
    removeItem,
    clearQueue,
    retryItem,
    uploadQueuedFiles,
  };
}
