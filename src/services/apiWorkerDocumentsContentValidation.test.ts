import { describe, expect, test } from "bun:test";
import {
  replaceWorkerDocument,
  uploadWorkerDocument,
} from "./apiWorkerDocuments";

function renamedExecutable(name: string) {
  return new File([new TextEncoder().encode("MZfake-executable")], name);
}

describe("worker document service content validation", () => {
  test("upload rejects mismatched bytes before entering the core service", async () => {
    await expect(
      uploadWorkerDocument({
        workerId: 1,
        documentTypeId: 1,
        file: renamedExecutable("archivo.pdf"),
      })
    ).rejects.toThrow("El contenido del archivo no coincide con su extensión");
  });

  test("replacement rejects mismatched bytes before entering the core service", async () => {
    await expect(
      replaceWorkerDocument({
        workerId: 1,
        documentTypeId: 1,
        file: renamedExecutable("archivo.docx"),
      })
    ).rejects.toThrow("El contenido del archivo no coincide con su extensión");
  });
});
