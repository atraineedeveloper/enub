export {
  addReportStatusToCategories,
  buildReplacedWorkerDocument,
  createWorkerDocumentStoragePath,
  deleteWorkerDocument,
  getWorkerDocumentCategoriesAndTypes,
  getWorkerDocumentReportData,
  getWorkerDocumentSignedUrl,
  getWorkerDocuments,
  getWorkerDocumentsBySemester,
  mapWorkerDocumentDatabaseError,
  sanitizeStorageFileName,
} from "./apiWorkerDocumentsCore";
import {
  replaceWorkerDocument as replaceWorkerDocumentCore,
  uploadWorkerDocument as uploadWorkerDocumentCore,
} from "./apiWorkerDocumentsCore";
import { validateWorkerDocumentFileContent } from "./workerDocumentFileContent";

interface WorkerDocumentUploadInput {
  workerId: number;
  documentTypeId: number;
  semesterId?: number | string | null;
  file: File;
}

export async function uploadWorkerDocument(input: WorkerDocumentUploadInput) {
  await validateWorkerDocumentFileContent(input.file);
  return uploadWorkerDocumentCore(input);
}

export async function replaceWorkerDocument(input: WorkerDocumentUploadInput) {
  await validateWorkerDocumentFileContent(input.file);
  return replaceWorkerDocumentCore(input);
}
