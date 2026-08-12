import { describe, expect, test } from "bun:test";
import { validateWorkerDocumentFileContent } from "./workerDocumentFileContent";
import { MAX_WORKER_DOCUMENT_FILE_SIZE_BYTES } from "./workerDocumentUploadLimits";

const encoder = new TextEncoder();

function file(name: string, bytes: number[] | Uint8Array) {
  return new File([new Uint8Array(bytes)], name);
}

function asciiFile(name: string, value: string) {
  return new File([encoder.encode(value)], name);
}

async function expectValid(candidate: File) {
  await expect(validateWorkerDocumentFileContent(candidate)).resolves.toBeUndefined();
}

async function expectInvalid(candidate: File) {
  await expect(validateWorkerDocumentFileContent(candidate)).rejects.toThrow(
    "El contenido del archivo no coincide con su extensión"
  );
}

describe("validateWorkerDocumentFileContent", () => {
  test("accepts a PDF signature and tolerates a UTF-8 BOM/short leading whitespace", async () => {
    await expectValid(asciiFile("documento.pdf", "%PDF-1.7\ncontenido"));
    await expectValid(
      file("documento.pdf", [
        0xef,
        0xbb,
        0xbf,
        0x20,
        0x0a,
        ...encoder.encode("%PDF-1.7\ncontenido"),
      ])
    );
  });

  test("accepts JPEG, PNG and WEBP signatures", async () => {
    await expectValid(file("foto.jpg", [0xff, 0xd8, 0xff, 0xe0, 0x00]));
    await expectValid(
      file("imagen.png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
    );
    await expectValid(
      file("imagen.webp", [
        0x52,
        0x49,
        0x46,
        0x46,
        0x00,
        0x00,
        0x00,
        0x00,
        0x57,
        0x45,
        0x42,
        0x50,
      ])
    );
  });

  test("accepts legacy Word/Excel OLE containers", async () => {
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00];
    await expectValid(file("oficio.doc", ole));
    await expectValid(file("tabla.xls", ole));
  });

  test("accepts DOCX and XLSX only when the ZIP exposes the expected Office family", async () => {
    const zipHeader = [0x50, 0x4b, 0x03, 0x04];

    await expectValid(
      file("oficio.docx", [
        ...zipHeader,
        ...encoder.encode("[Content_Types].xml word/document.xml"),
      ])
    );
    await expectValid(
      file("tabla.xlsx", [
        ...zipHeader,
        ...encoder.encode("[Content_Types].xml xl/workbook.xml"),
      ])
    );

    await expectInvalid(
      file("oficio.docx", [
        ...zipHeader,
        ...encoder.encode("[Content_Types].xml xl/workbook.xml"),
      ])
    );
    await expectInvalid(
      file("tabla.xlsx", [
        ...zipHeader,
        ...encoder.encode("[Content_Types].xml word/document.xml"),
      ])
    );
  });

  test("rejects an executable-like payload renamed with an allowed extension", async () => {
    await expectInvalid(asciiFile("renombrado.pdf", "MZfake-executable"));
    await expectInvalid(asciiFile("renombrado.docx", "MZfake-executable"));
  });

  test("rejects a generic ZIP renamed as an Office document", async () => {
    await expectInvalid(
      file("archivo.docx", [
        0x50,
        0x4b,
        0x03,
        0x04,
        ...encoder.encode("random/file.txt"),
      ])
    );
  });

  test("rejects oversized files before attempting a full byte read", async () => {
    const oversizedFile = {
      name: "demasiado-grande.pdf",
      size: MAX_WORKER_DOCUMENT_FILE_SIZE_BYTES + 1,
      arrayBuffer: async () => {
        throw new Error("arrayBuffer should not be called");
      },
    } as unknown as File;

    await expect(validateWorkerDocumentFileContent(oversizedFile)).rejects.toThrow(
      "El archivo no debe pesar más de 10 MB"
    );
  });
});
