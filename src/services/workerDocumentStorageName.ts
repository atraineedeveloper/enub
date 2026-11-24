const STORAGE_BASENAME_FALLBACK = "archivo";
// A generous but bounded segment length -- long enough that no real
// document name is ever truncated in practice, short enough to keep the
// full storage key (workerId/documentTypeId/scope/uuid-basename.ext) well
// under any object-storage key-length limit.
const MAX_STORAGE_BASENAME_LENGTH = 100;

// Turns an arbitrary, user-supplied file name into a conservative, portable
// Storage object-key segment. This is a pure function specifically so it
// can be unit-tested directly (apiWorkerDocuments.test.ts) without a
// Supabase client. It is never used for the user-visible file name --
// `worker_documents.file_name` always stores the original `file.name`
// unchanged; only the Storage path is built from this sanitized value.
//
// A Storage key containing raw accented Unicode (e.g. "í", "ó", "ñ") is
// rejected by Supabase Storage with a 400 InvalidKey error -- the previous
// version of this function only handled path separators and whitespace,
// leaving every accented character untouched. This version:
// 1. trims surrounding whitespace;
// 2 (+3). Unicode-normalizes to NFKD and strips the resulting combining
//    diacritical marks (turning "í" into "i", "ñ" into "n", etc.);
// 4. lowercases the basename;
// 5. replaces "/" and "\" path separators;
// 6 (+7). replaces any run of characters outside the conservative
//    [a-z0-9-_] set (including the now-bare disallowed remnants of step
//    5) with a single "-";
// 8. collapses repeated "-";
// 9. trims leading/trailing separators;
// 10. preserves a normalized (lowercased, alnum-only) extension separately
//     from the basename, so the sanitizer never introduces more than one
//     final "." in the result;
// 11. falls back to a fixed basename if sanitization removes everything.
export function sanitizeStorageFileName(fileName: string = "") {
  const trimmed = fileName.trim();
  const lastDotIndex = trimmed.lastIndexOf(".");
  // A dot only counts as an extension separator when it isn't the first
  // character (a leading dot alone is a hidden-file marker, not an
  // extension separator) and isn't the last character (nothing follows
  // it). This avoids treating ".hiddenfile" as basename "" + extension
  // "hiddenfile", which would otherwise duplicate into "hiddenfile.hiddenfile".
  const hasExtension = lastDotIndex > 0 && lastDotIndex < trimmed.length - 1;
  const rawBasename = hasExtension ? trimmed.slice(0, lastDotIndex) : trimmed;
  const extension = hasExtension
    ? trimmed.slice(lastDotIndex + 1).toLowerCase()
    : "";

  const safeBasename = rawBasename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[/\\]/g, "-")
    .replace(/[^a-z0-9\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, MAX_STORAGE_BASENAME_LENGTH)
    .replace(/^[-_]+|[-_]+$/g, "");

  const safeExtension = extension.replace(/[^a-z0-9]/g, "");
  const finalBasename = safeBasename || STORAGE_BASENAME_FALLBACK;

  return safeExtension ? `${finalBasename}.${safeExtension}` : finalBasename;
}

