import supabase from "./supabase";

const WORKER_DOCUMENTS_BUCKET = "worker_documents";
const MAX_WORKER_DOCUMENT_SIZE = 10 * 1024 * 1024;
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60;
const ALLOWED_FILE_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
  "webp",
]);
const WORKER_DOCUMENT_SELECT =
  "*, worker_document_types(*, worker_document_categories(*)), semesters(*)";

function getFileExtension(fileName = "") {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function sanitizeStorageFileName(fileName = "") {
  return fileName
    .trim()
    .replace(/[/\\]/g, "-")
    .replace(/\s+/g, "-");
}

function normalizeSemesterId(semesterId) {
  return semesterId === undefined || semesterId === "" ? null : semesterId;
}

function normalizeRequiredSemesterId(semesterId) {
  const normalizedSemesterId = Number(semesterId);

  if (!Number.isInteger(normalizedSemesterId) || normalizedSemesterId <= 0) {
    throw new Error("El semestre es requerido");
  }

  return normalizedSemesterId;
}

function validateWorkerDocumentFile(file) {
  if (!file) throw new Error("El archivo es requerido");

  const extension = getFileExtension(file.name);

  if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
    throw new Error(
      "El archivo debe ser PDF, Word, Excel o una imagen válida"
    );
  }

  if (!file.size || file.size > MAX_WORKER_DOCUMENT_SIZE) {
    throw new Error("El archivo no debe pesar más de 10 MB");
  }
}

function createWorkerDocumentStoragePath({
  workerId,
  documentTypeId,
  semesterId,
  file,
}) {
  const scopeFolder = normalizeSemesterId(semesterId) ?? "permanent";
  const safeFileName = sanitizeStorageFileName(file.name);

  return `${workerId}/${documentTypeId}/${scopeFolder}/${crypto.randomUUID()}-${safeFileName}`;
}

async function getDocumentType(documentTypeId) {
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
}) {
  let query = supabase
    .from("worker_documents")
    .select("*")
    .eq("worker_id", workerId)
    .eq("document_type_id", documentTypeId);

  if (normalizeSemesterId(semesterId) === null) {
    query = query.is("semester_id", null);
  } else {
    query = query.eq("semester_id", semesterId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    throw new Error("Los documentos del trabajador no pudieron cargarse");
  }

  return data ?? [];
}

async function uploadWorkerDocumentFile(storagePath, file) {
  const { error } = await supabase.storage
    .from(WORKER_DOCUMENTS_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (error) {
    console.error(error);
    throw new Error("El archivo no pudo subirse");
  }
}

async function removeWorkerDocumentFiles(storagePaths = []) {
  const pathsToRemove = storagePaths.filter(Boolean);
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
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
      },
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
    throw new Error("El registro del documento no pudo guardarse");
  }

  return data;
}

function groupDocumentTypesByCategory(categories = [], documentTypes = []) {
  return categories.map((category) => ({
    ...category,
    document_types: documentTypes.filter(
      (documentType) => documentType.category_id === category.id
    ),
  }));
}

function addReportStatusToCategories(categories = [], documents = []) {
  return categories.map((category) => ({
    ...category,
    document_types: category.document_types.map((documentType) => {
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

export async function getWorkerDocuments(workerId) {
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

export async function getWorkerDocumentsBySemester(workerId, semesterId) {
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

export async function uploadWorkerDocument({
  workerId,
  documentTypeId,
  semesterId = null,
  file,
}) {
  if (!workerId) throw new Error("El trabajador es requerido");
  if (!documentTypeId) throw new Error("El tipo de documento es requerido");

  validateWorkerDocumentFile(file);

  const documentType = await getDocumentType(documentTypeId);

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

export async function replaceWorkerDocument({
  workerId,
  documentTypeId,
  semesterId = null,
  file,
}) {
  if (!workerId) throw new Error("El trabajador es requerido");
  if (!documentTypeId) throw new Error("El tipo de documento es requerido");

  validateWorkerDocumentFile(file);

  const documentType = await getDocumentType(documentTypeId);

  if (documentType.allows_multiple) {
    throw new Error("Este tipo de documento permite múltiples archivos");
  }

  const existingDocuments = await getExistingWorkerDocuments({
    workerId,
    documentTypeId,
    semesterId,
  });
  const storagePath = createWorkerDocumentStoragePath({
    workerId,
    documentTypeId,
    semesterId,
    file,
  });

  await uploadWorkerDocumentFile(storagePath, file);

  if (existingDocuments.length) {
    const { error: deleteError } = await supabase
      .from("worker_documents")
      .delete()
      .in(
        "id",
        existingDocuments.map((document) => document.id)
      );

    if (deleteError) {
      try {
        await removeWorkerDocumentFiles([storagePath]);
      } catch (cleanupError) {
        console.error(cleanupError);
      }

      console.error(deleteError);
      throw new Error("El documento anterior no pudo eliminarse");
    }
  }

  const newDocument = await insertWorkerDocumentMetadata({
    workerId,
    documentTypeId,
    semesterId,
    file,
    storagePath,
  });

  try {
    await removeWorkerDocumentFiles(
      existingDocuments.map((document) => document.storage_path)
    );
  } catch (cleanupError) {
    console.error(cleanupError);
  }

  return newDocument;
}

export async function getWorkerDocumentSignedUrl(storagePath) {
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

export async function getWorkerDocumentReportData(workerId, semesterId = null) {
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
      .eq("id", semesterId)
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
