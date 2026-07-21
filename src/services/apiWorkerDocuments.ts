import supabase from "./supabase";
import type { Database } from "../types/supabase";
import {
  ALLOWED_DOCUMENT_FILE_EXTENSIONS,
  DOCUMENT_MIME_TYPE_BY_EXTENSION,
  MAX_WORKER_DOCUMENT_FILE_SIZE_BYTES,
  MAX_WORKER_DOCUMENT_FILE_SIZE_LABEL,
} from "./workerDocumentUploadLimits";

type WorkerDocumentCategoryRow =
  Database["public"]["Tables"]["worker_document_categories"]["Row"];
type WorkerDocumentTypeRow =
  Database["public"]["Tables"]["worker_document_types"]["Row"];
type WorkerDocumentRow = Database["public"]["Tables"]["worker_documents"]["Row"];
type WorkerDocumentInsert =
  Database["public"]["Tables"]["worker_documents"]["Insert"];

const WORKER_DOCUMENTS_BUCKET = "worker_documents";
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60;
const ALLOWED_FILE_EXTENSIONS = new Set<string>(
  ALLOWED_DOCUMENT_FILE_EXTENSIONS
);
const MIME_TYPE_BY_EXTENSION = DOCUMENT_MIME_TYPE_BY_EXTENSION;
const WORKER_DOCUMENT_SELECT =
  "*, worker_document_types(*, worker_document_categories(*)), semesters(*)";

function getFileExtension(fileName: string = "") {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

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

function normalizeSemesterId(semesterId?: number | string | null) {
  return semesterId === undefined || semesterId === "" ? null : semesterId;
}

function normalizeRequiredSemesterId(semesterId?: number | string | null) {
  const normalizedSemesterId = Number(semesterId);

  if (!Number.isInteger(normalizedSemesterId) || normalizedSemesterId <= 0) {
    throw new Error("El semestre es requerido");
  }

  return normalizedSemesterId;
}

function validateWorkerDocumentFile(file?: File | null) {
  if (!file) throw new Error("El archivo es requerido");

  const extension = getFileExtension(file.name);

  if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
    throw new Error(
      "El archivo debe ser PDF, Word, Excel o una imagen válida"
    );
  }

  if (!file.size || file.size > MAX_WORKER_DOCUMENT_FILE_SIZE_BYTES) {
    throw new Error(
      `El archivo no debe pesar más de ${MAX_WORKER_DOCUMENT_FILE_SIZE_LABEL}`
    );
  }
}

function getWorkerDocumentMimeType(file: File) {
  const extension = getFileExtension(file.name);
  return MIME_TYPE_BY_EXTENSION[extension] ?? file.type;
}

const LIFECYCLE_INACTIVE_MESSAGE =
  "Este tipo de documento ya no acepta nuevas cargas.";

// Maps the stable WDT01 database error code (design.md Decision 13) to the
// single controlled Spanish message, for every code path that can surface
// it: the ordinary upload path (the lifecycle trigger firing directly on
// INSERT), and the replacement path (either the trigger or the RPC's own
// explicit check). Never exposes the raw trigger name, function name, or
// SQL error detail to the caller.
export function mapWorkerDocumentDatabaseError(
  error: { code?: string | null } | null | undefined,
  fallbackMessage: string
) {
  if (error?.code === "WDT01") {
    return LIFECYCLE_INACTIVE_MESSAGE;
  }

  return fallbackMessage;
}

export function createWorkerDocumentStoragePath({
  workerId,
  documentTypeId,
  semesterId,
  file,
}: {
  workerId: number;
  documentTypeId: number;
  semesterId?: number | string | null;
  file: File;
}) {
  const scopeFolder = normalizeSemesterId(semesterId) ?? "permanent";
  const safeFileName = sanitizeStorageFileName(file.name);

  return `${workerId}/${documentTypeId}/${scopeFolder}/${crypto.randomUUID()}-${safeFileName}`;
}

async function getDocumentType(documentTypeId: number) {
  const { data, error } = await supabase
    .from("worker_document_types")
    .select("*, worker_document_categories(*)")
    .eq("id", documentTypeId)
    .single();

  if (error) {
    console.error(error);
    throw new Error("El tipo de documento no pudo cargarse");
  }

  return data;
}

async function getExistingWorkerDocuments({
  workerId,
  documentTypeId,
  semesterId,
}: {
  workerId: number;
  documentTypeId: number;
  semesterId?: number | string | null;
}) {
  let query = supabase
    .from("worker_documents")
    .select("*")
    .eq("worker_id", workerId)
    .eq("document_type_id", documentTypeId);

  if (normalizeSemesterId(semesterId) === null) {
    query = query.is("semester_id", null);
  } else {
    // semesterId is proven non-null/non-empty here (the `if` branch above
    // covers that case) but keeps its wider caller type; cast reflects that
    // narrowing without changing what value is actually sent.
    query = query.eq("semester_id", semesterId as number);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    throw new Error("Los documentos del trabajador no pudieron cargarse");
  }

  return data ?? [];
}

async function uploadWorkerDocumentFile(storagePath: string, file: File) {
  const { error } = await supabase.storage
    .from(WORKER_DOCUMENTS_BUCKET)
    .upload(storagePath, file, {
      contentType: getWorkerDocumentMimeType(file),
      upsert: false,
    });

  if (error) {
    console.error(error);
    throw new Error("El archivo no pudo subirse");
  }
}

async function getWorkerDocumentForDelete(documentId: number) {
  const { data, error } = await supabase
    .from("worker_documents")
    .select("id, worker_id, storage_path")
    .eq("id", documentId)
    .single();

  if (error) {
    console.error(error);
    throw new Error("El documento no pudo cargarse");
  }

  return data;
}

async function removeWorkerDocumentFiles(storagePaths: (string | null | undefined)[] = []) {
  const pathsToRemove = storagePaths.filter(Boolean) as string[];
  if (!pathsToRemove.length) return;

  const { error } = await supabase.storage
    .from(WORKER_DOCUMENTS_BUCKET)
    .remove(pathsToRemove);

  if (error) {
    console.error(error);
    throw new Error("Los archivos anteriores no pudieron eliminarse");
  }
}

async function insertWorkerDocumentMetadata({
  workerId,
  documentTypeId,
  semesterId,
  file,
  storagePath,
}: {
  workerId: number;
  documentTypeId: number;
  semesterId?: number | string | null;
  file: File;
  storagePath: string;
}) {
  const { data, error } = await supabase
    .from("worker_documents")
    .insert([
      {
        worker_id: workerId,
        document_type_id: documentTypeId,
        semester_id: normalizeSemesterId(semesterId),
        file_name: file.name,
        storage_path: storagePath,
        mime_type: getWorkerDocumentMimeType(file),
        file_size: file.size,
      } as WorkerDocumentInsert,
    ])
    .select("*, worker_document_types(*, worker_document_categories(*))")
    .single();

  if (error) {
    try {
      await removeWorkerDocumentFiles([storagePath]);
    } catch (cleanupError) {
      console.error(cleanupError);
    }

    console.error(error);
    throw new Error(
      mapWorkerDocumentDatabaseError(
        error,
        "El registro del documento no pudo guardarse"
      )
    );
  }

  return data;
}

function groupDocumentTypesByCategory(
  categories: WorkerDocumentCategoryRow[] = [],
  documentTypes: WorkerDocumentTypeRow[] = []
) {
  return categories.map((category) => ({
    ...category,
    document_types: documentTypes.filter(
      (documentType) => documentType.category_id === category.id
    ),
  }));
}

// Builds the client-facing replaced-document object directly from
// replace_worker_document_metadata's own RETURNING row, plus the document
// type already fetched earlier in the same call -- this is the entire
// "success result" the RPC's design (finding #4) exists to make possible:
// no separate post-commit fetch is ever needed to learn what was just
// inserted, since the RPC's own transaction already returned it.
export function buildReplacedWorkerDocument(
  result: {
    new_id: number;
    new_worker_id: number;
    new_document_type_id: number;
    new_semester_id: number | null;
    new_file_name: string;
    new_storage_path: string;
    new_mime_type: string;
    new_file_size: number;
    new_uploaded_by: string | null;
    new_created_at: string;
  },
  documentType: unknown
) {
  return {
    id: result.new_id,
    worker_id: result.new_worker_id,
    document_type_id: result.new_document_type_id,
    semester_id: result.new_semester_id,
    file_name: result.new_file_name,
    storage_path: result.new_storage_path,
    mime_type: result.new_mime_type,
    file_size: result.new_file_size,
    uploaded_by: result.new_uploaded_by,
    created_at: result.new_created_at,
    worker_document_types: documentType,
  };
}

export function addReportStatusToCategories(
  categories: (WorkerDocumentCategoryRow & {
    document_types: WorkerDocumentTypeRow[];
  })[] = [],
  documents: WorkerDocumentRow[] = []
) {
  return categories.map((category) => ({
    ...category,
    // Union rule (matching WorkerDocumentsView.tsx): a type appears in this
    // worker's own report only when it is active, or this same worker has
    // at least one document under it -- an inactive type with none for
    // this worker is omitted entirely, never rendered as "Pendiente".
    document_types: category.document_types
      .filter((documentType) => {
        const hasDocumentsForThisWorker = documents.some(
          (document) => document.document_type_id === documentType.id
        );
        return documentType.is_active || hasDocumentsForThisWorker;
      })
      .map((documentType) => {
        const uploadedDocuments = documents.filter(
          (document) => document.document_type_id === documentType.id
        );

        return {
          ...documentType,
          documents: uploadedDocuments,
          status: uploadedDocuments.length ? "Cargado" : "Pendiente",
          uploaded_at: uploadedDocuments[0]?.created_at ?? null,
          file_name: uploadedDocuments[0]?.file_name ?? null,
        };
      }),
  }));
}

export async function getWorkerDocumentCategoriesAndTypes() {
  const { data: categories, error: categoriesError } = await supabase
    .from("worker_document_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (categoriesError) {
    console.error(categoriesError);
    throw new Error("Las categorías de documentos no pudieron cargarse");
  }

  const { data: documentTypes, error: documentTypesError } = await supabase
    .from("worker_document_types")
    .select("*")
    .order("sort_order", { ascending: true });

  if (documentTypesError) {
    console.error(documentTypesError);
    throw new Error("Los tipos de documentos no pudieron cargarse");
  }

  return groupDocumentTypesByCategory(categories ?? [], documentTypes ?? []);
}

export async function getWorkerDocuments(workerId: number) {
  if (!workerId) throw new Error("El trabajador es requerido");

  const { data, error } = await supabase
    .from("worker_documents")
    .select(WORKER_DOCUMENT_SELECT)
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new Error("Los documentos del trabajador no pudieron cargarse");
  }

  return data;
}

export async function getWorkerDocumentsBySemester(
  workerId: number,
  semesterId?: number | string | null
) {
  if (!workerId) throw new Error("El trabajador es requerido");
  const selectedSemesterId = normalizeRequiredSemesterId(semesterId);

  const { data, error } = await supabase
    .from("worker_documents")
    .select(WORKER_DOCUMENT_SELECT)
    .eq("worker_id", workerId)
    .or(`semester_id.is.null,semester_id.eq.${selectedSemesterId}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new Error("Los documentos del trabajador no pudieron cargarse");
  }

  return data;
}

interface UploadWorkerDocumentInput {
  workerId: number;
  documentTypeId: number;
  semesterId?: number | string | null;
  file: File;
}

export async function uploadWorkerDocument({
  workerId,
  documentTypeId,
  semesterId = null,
  file,
}: UploadWorkerDocumentInput) {
  if (!workerId) throw new Error("El trabajador es requerido");
  if (!documentTypeId) throw new Error("El tipo de documento es requerido");

  validateWorkerDocumentFile(file);

  const documentType = await getDocumentType(documentTypeId);

  if (!documentType.is_active) {
    throw new Error("Este tipo de documento ya no acepta nuevas cargas.");
  }

  if (!documentType.allows_multiple) {
    const existingDocuments = await getExistingWorkerDocuments({
      workerId,
      documentTypeId,
      semesterId,
    });

    if (existingDocuments.length) {
      throw new Error("Este documento ya existe. Usa la opción de reemplazar");
    }
  }

  const storagePath = createWorkerDocumentStoragePath({
    workerId,
    documentTypeId,
    semesterId,
    file,
  });

  await uploadWorkerDocumentFile(storagePath, file);

  return insertWorkerDocumentMetadata({
    workerId,
    documentTypeId,
    semesterId,
    file,
    storagePath,
  });
}

// The old metadata row is replaced by a single database transaction
// (replace_worker_document_metadata), not by separate client-orchestrated
// delete/insert calls: the RPC deletes the superseded row and inserts the
// replacement entirely inside its own transaction, so any failure (an
// inactive-type rejection, the single-file integrity trigger, an RLS
// rejection, or any other database error) rolls back automatically and
// restores the superseded row -- see design.md Decision 5 for why an
// insert-before-delete client-side ordering was unsafe.
export async function replaceWorkerDocument({
  workerId,
  documentTypeId,
  semesterId = null,
  file,
}: UploadWorkerDocumentInput) {
  if (!workerId) throw new Error("El trabajador es requerido");
  if (!documentTypeId) throw new Error("El tipo de documento es requerido");

  validateWorkerDocumentFile(file);

  const documentType = await getDocumentType(documentTypeId);

  if (!documentType.is_active) {
    throw new Error("Este tipo de documento ya no acepta nuevas cargas.");
  }

  if (documentType.allows_multiple) {
    throw new Error("Este tipo de documento permite múltiples archivos");
  }

  const storagePath = createWorkerDocumentStoragePath({
    workerId,
    documentTypeId,
    semesterId,
    file,
  });

  await uploadWorkerDocumentFile(storagePath, file);

  const { data, error } = await supabase.rpc(
    "replace_worker_document_metadata",
    // p_semester_id is a nullable bigint in the database, but the
    // generated Args type reports it as non-nullable `number` -- a known
    // gap in Supabase's type generation for function parameters (it does
    // not reflect PL/pgSQL parameter nullability the way column
    // nullability is reflected). This cast bridges that gap; the value
    // sent over the wire is correct either way.
    {
      p_worker_id: workerId,
      p_document_type_id: documentTypeId,
      p_semester_id: normalizeSemesterId(semesterId),
      p_file_name: file.name,
      p_storage_path: storagePath,
      p_mime_type: getWorkerDocumentMimeType(file),
      p_file_size: file.size,
    } as Database["public"]["Functions"]["replace_worker_document_metadata"]["Args"]
  );

  if (error) {
    // The RPC's own transaction never committed -- the previous metadata
    // and previous storage object require no cleanup here, only the
    // just-uploaded new object does.
    try {
      await removeWorkerDocumentFiles([storagePath]);
    } catch (cleanupError) {
      console.error(cleanupError);
    }

    console.error(error);
    throw new Error(
      mapWorkerDocumentDatabaseError(error, "El documento no pudo reemplazarse")
    );
  }

  const result = data?.[0];

  if (!result) {
    throw new Error("El documento no pudo reemplazarse");
  }

  // The database transaction has already committed at this point -- the
  // RPC's own RETURNING clause already gave back the complete new row, so
  // no separate post-commit fetch is performed. A network hiccup from here
  // on can only ever affect the best-effort old-storage cleanup below,
  // never make an already-committed, successful replacement masquerade as
  // a failed one.
  const newDocument = buildReplacedWorkerDocument(result, documentType);

  // Best-effort, non-fatal: the replacement already succeeded and must not
  // be rolled back or reported as a failure here. A cleanup failure is
  // surfaced to the caller as storageCleanupFailed (matching
  // deleteWorkerDocument's existing convention) rather than only logged,
  // so the UI can show a distinguishable, non-fatal warning instead of
  // silently swallowing it.
  let storageCleanupFailed = false;

  try {
    await removeWorkerDocumentFiles(result.old_storage_paths ?? []);
  } catch (cleanupError) {
    console.error(cleanupError);
    storageCleanupFailed = true;
  }

  return { ...newDocument, storageCleanupFailed };
}

// Deletes a single worker_documents row and its storage object.
//
// Takes only documentId -- never a caller-supplied storagePath -- and
// fetches the row itself first (worker-self-service-documents/worker-
// documents-ux-and-delete decisions.md #3). That fetch is RLS-scoped like
// every other read on this table: a worker session can only ever fetch
// their own document, so a non-owner's attempt fails here (a clear "could
// not load" error), before any delete is attempted -- there is no
// separate ownership check in this function, RLS is the boundary.
//
// Order matters: the DB row is deleted first, then the storage object.
// - If the row delete fails, the storage object is never touched.
// - If the row delete succeeds but the storage removal then fails, the
//   row is NOT reinserted (the document is already correctly gone from
//   the expediente). The result is returned with storageCleanupFailed:
//   true instead of thrown, so callers can distinguish "fully deleted"
//   from "deleted, but the file may need manual cleanup" rather than
//   treating the second as an outright failure.
export async function deleteWorkerDocument(documentId: number) {
  if (!documentId) throw new Error("El documento es requerido");

  const document = await getWorkerDocumentForDelete(documentId);

  const { error: deleteError } = await supabase
    .from("worker_documents")
    .delete()
    .eq("id", documentId);

  if (deleteError) {
    console.error(deleteError);
    throw new Error("El documento no pudo eliminarse");
  }

  try {
    await removeWorkerDocumentFiles([document.storage_path]);
  } catch (cleanupError) {
    console.error(cleanupError);
    return {
      documentId,
      workerId: document.worker_id,
      storageCleanupFailed: true,
    };
  }

  return {
    documentId,
    workerId: document.worker_id,
    storageCleanupFailed: false,
  };
}

export async function getWorkerDocumentSignedUrl(storagePath: string) {
  if (!storagePath) throw new Error("La ruta del archivo es requerida");

  const { data, error } = await supabase.storage
    .from(WORKER_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN_SECONDS);

  if (error) {
    console.error(error);
    throw new Error("El enlace del documento no pudo generarse");
  }

  return data.signedUrl;
}

export async function getWorkerDocumentReportData(
  workerId: number,
  semesterId?: number | string | null
) {
  if (!workerId) throw new Error("El trabajador es requerido");

  const { data: worker, error: workerError } = await supabase
    .from("workers")
    .select("id, name, RFC, type_worker, status")
    .eq("id", workerId)
    .single();

  if (workerError) {
    console.error(workerError);
    throw new Error("El trabajador no pudo cargarse");
  }

  const categories = await getWorkerDocumentCategoriesAndTypes();
  const documents = semesterId
    ? await getWorkerDocumentsBySemester(workerId, semesterId)
    : await getWorkerDocuments(workerId);

  let semester = null;

  if (semesterId) {
    const { data: semesterData, error: semesterError } = await supabase
      .from("semesters")
      .select("*")
      .eq("id", semesterId as number)
      .single();

    if (semesterError) {
      console.error(semesterError);
      throw new Error("El semestre no pudo cargarse");
    }

    semester = semesterData;
  }

  return {
    worker,
    semester,
    categories: addReportStatusToCategories(categories, documents ?? []),
  };
}
