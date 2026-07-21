import {
  ALLOWED_DOCUMENT_FILE_EXTENSIONS,
  MAX_FILES_PER_UPLOAD_BATCH,
  MAX_WORKER_DOCUMENT_FILE_SIZE_BYTES,
  MAX_WORKER_DOCUMENT_FILE_SIZE_LABEL,
} from "../../../services/workerDocumentUploadLimits";
import { getWorkerDocumentFileExtension } from "./workerDocumentDisplay";

// Pure, no React/DOM involved -- directly unit testable
// (resolveFileSelection.test.ts), separate from MultiFileDropzone's own
// event wiring (onDrop/onChange), which only ever calls this.

export function isSameQueuedFile(a: File, b: File): boolean {
  return (
    a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
  );
}

export function validateDocumentFileTypeAndSize(file: File): string | null {
  const extension = getWorkerDocumentFileExtension(file.name).toLowerCase();

  if (!(ALLOWED_DOCUMENT_FILE_EXTENSIONS as readonly string[]).includes(extension)) {
    return `"${file.name}" no es un tipo de archivo permitido`;
  }

  if (!file.size || file.size > MAX_WORKER_DOCUMENT_FILE_SIZE_BYTES) {
    return `"${file.name}" pesa más de ${MAX_WORKER_DOCUMENT_FILE_SIZE_LABEL}`;
  }

  return null;
}

export interface FileSelectionResolution {
  accepted: File[];
  errors: string[];
}

// Given the files a user just picked/dropped and the files already queued
// for this same document type, returns exactly which of the new files may
// be added (valid type/size, not a duplicate of an existing or
// already-accepted-in-this-same-call file, within the per-batch max) and
// human-readable Spanish error messages for every rejected one. Order of
// checks matches what the user would find most actionable: duplicates
// first (nothing to fix, just informational), then type/size (fixable by
// picking a different file), then the batch limit (stops accepting
// further files once reached, rather than silently dropping some).
export function resolveFileSelection(
  incomingFiles: File[],
  existingQueueFiles: File[]
): FileSelectionResolution {
  const accepted: File[] = [];
  const errors: string[] = [];
  let remainingSlots = MAX_FILES_PER_UPLOAD_BATCH - existingQueueFiles.length;

  for (const file of incomingFiles) {
    if (remainingSlots <= 0) {
      errors.push(
        `Se alcanzó el máximo de ${MAX_FILES_PER_UPLOAD_BATCH} archivos; se omitieron los demás`
      );
      break;
    }

    const isDuplicate =
      existingQueueFiles.some((queued) => isSameQueuedFile(queued, file)) ||
      accepted.some((queued) => isSameQueuedFile(queued, file));

    if (isDuplicate) {
      errors.push(`"${file.name}" ya se agregó`);
      continue;
    }

    const validationError = validateDocumentFileTypeAndSize(file);
    if (validationError) {
      errors.push(validationError);
      continue;
    }

    accepted.push(file);
    remainingSlots -= 1;
  }

  return { accepted, errors };
}
