import {
  ALLOWED_DOCUMENT_FILE_EXTENSIONS,
  MAX_WORKER_DOCUMENT_FILE_SIZE_BYTES,
  MAX_WORKER_DOCUMENT_FILE_SIZE_LABEL,
} from "./workerDocumentUploadLimits";

type AllowedExtension = (typeof ALLOWED_DOCUMENT_FILE_EXTENSIONS)[number];

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP_LOCAL_FILE_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const UTF8_BOM = [0xef, 0xbb, 0xbf];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const MAX_LEADING_PDF_WHITESPACE_BYTES = 16;

const ALLOWED_EXTENSIONS = new Set<string>(ALLOWED_DOCUMENT_FILE_EXTENSIONS);

function getFileExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function startsWithBytes(
  bytes: Uint8Array,
  signature: readonly number[],
  offset = 0
) {
  if (bytes.length < offset + signature.length) return false;

  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[offset + index] !== signature[index]) return false;
  }

  return true;
}

function isAsciiWhitespace(byte: number) {
  return byte === 0x09 || byte === 0x0a || byte === 0x0c || byte === 0x0d || byte === 0x20;
}

function hasPdfSignature(bytes: Uint8Array) {
  let offset = startsWithBytes(bytes, UTF8_BOM) ? UTF8_BOM.length : 0;
  let whitespaceCount = 0;

  while (
    offset < bytes.length &&
    whitespaceCount < MAX_LEADING_PDF_WHITESPACE_BYTES &&
    isAsciiWhitespace(bytes[offset])
  ) {
    offset += 1;
    whitespaceCount += 1;
  }

  return startsWithBytes(bytes, PDF_SIGNATURE, offset);
}

function containsAscii(bytes: Uint8Array, value: string) {
  const needle = new TextEncoder().encode(value);
  if (!needle.length || bytes.length < needle.length) return false;

  outer: for (let offset = 0; offset <= bytes.length - needle.length; offset += 1) {
    for (let index = 0; index < needle.length; index += 1) {
      if (bytes[offset + index] !== needle[index]) continue outer;
    }
    return true;
  }

  return false;
}

function hasWebpSignature(bytes: Uint8Array) {
  return (
    startsWithBytes(bytes, RIFF, 0) &&
    startsWithBytes(bytes, WEBP, 8)
  );
}

function hasOfficeOpenXmlSignature(bytes: Uint8Array, folder: "word" | "xl") {
  return (
    startsWithBytes(bytes, ZIP_LOCAL_FILE_SIGNATURE) &&
    containsAscii(bytes, "[Content_Types].xml") &&
    containsAscii(bytes, `${folder}/`)
  );
}

function contentMatchesExtension(extension: AllowedExtension, bytes: Uint8Array) {
  switch (extension) {
    case "pdf":
      return hasPdfSignature(bytes);
    case "jpg":
    case "jpeg":
      return startsWithBytes(bytes, JPEG_SIGNATURE);
    case "png":
      return startsWithBytes(bytes, PNG_SIGNATURE);
    case "webp":
      return hasWebpSignature(bytes);
    case "doc":
    case "xls":
      return startsWithBytes(bytes, OLE_SIGNATURE);
    case "docx":
      return hasOfficeOpenXmlSignature(bytes, "word");
    case "xlsx":
      return hasOfficeOpenXmlSignature(bytes, "xl");
  }
}

export async function validateWorkerDocumentFileContent(file: File) {
  const extension = getFileExtension(file.name);

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("El formato del archivo no está permitido");
  }

  // Reject invalid/oversized files before reading their complete bytes into
  // memory. The core service repeats the same 10 MiB boundary as defense in
  // depth before Storage, but content inspection must not run first.
  if (!file.size || file.size > MAX_WORKER_DOCUMENT_FILE_SIZE_BYTES) {
    throw new Error(
      `El archivo no debe pesar más de ${MAX_WORKER_DOCUMENT_FILE_SIZE_LABEL}`
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (!contentMatchesExtension(extension as AllowedExtension, bytes)) {
    throw new Error(
      "El contenido del archivo no coincide con su extensión. Verifica que el archivo no esté dañado o renombrado."
    );
  }
}
