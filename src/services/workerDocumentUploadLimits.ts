// Single source of truth for worker-document upload limits, shared between
// the data-access layer (apiWorkerDocuments.ts, which enforces these
// values) and the upload UI (MultiFileDropzone and friends, which display
// them to the user before they pick a file, not only after a rejection).
// Before this module existed, the allowed extensions/MIME map/size limit
// were duplicated by hand in both places -- a real risk of silent drift if
// one were edited without the other.

export const ALLOWED_DOCUMENT_FILE_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
  "webp",
] as const;

export const DOCUMENT_MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const MAX_WORKER_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Human-readable label for the same value above -- kept as a literal
// string rather than derived (e.g. `${MAX_WORKER_DOCUMENT_FILE_SIZE_BYTES / 1024 / 1024} MB`)
// so a UI string search for "10 MB" finds this file directly.
export const MAX_WORKER_DOCUMENT_FILE_SIZE_LABEL = "10 MB";

// A ceiling on how many files a single drag-and-drop/multi-select
// operation may queue at once -- a UX guard against an accidental
// whole-folder drop, not a data-integrity requirement (the backend has no
// per-request file-count limit of its own).
export const MAX_FILES_PER_UPLOAD_BATCH = 10;

// Native <input accept="..."> attribute value.
export const DOCUMENT_FILE_INPUT_ACCEPT = ALLOWED_DOCUMENT_FILE_EXTENSIONS.map(
  (extension) => `.${extension}`
).join(",");

// Spanish, user-facing summary of the allowed file types -- shown
// proactively next to the upload dropzone, not only after a rejected file.
export const ALLOWED_DOCUMENT_TYPES_LABEL =
  "PDF, Word, Excel o imagen (JPG, PNG, WEBP)";
