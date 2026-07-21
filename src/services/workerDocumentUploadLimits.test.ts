import { describe, expect, test } from "bun:test";
import {
  ALLOWED_DOCUMENT_FILE_EXTENSIONS,
  DOCUMENT_FILE_INPUT_ACCEPT,
  DOCUMENT_MIME_TYPE_BY_EXTENSION,
  MAX_FILES_PER_UPLOAD_BATCH,
  MAX_WORKER_DOCUMENT_FILE_SIZE_BYTES,
  MAX_WORKER_DOCUMENT_FILE_SIZE_LABEL,
} from "./workerDocumentUploadLimits";

describe("workerDocumentUploadLimits (single source of truth)", () => {
  test("DOCUMENT_FILE_INPUT_ACCEPT is derived from every allowed extension, never hand-duplicated", () => {
    for (const extension of ALLOWED_DOCUMENT_FILE_EXTENSIONS) {
      expect(DOCUMENT_FILE_INPUT_ACCEPT).toContain(`.${extension}`);
    }
    expect(DOCUMENT_FILE_INPUT_ACCEPT.split(",")).toHaveLength(
      ALLOWED_DOCUMENT_FILE_EXTENSIONS.length
    );
  });

  test("every allowed extension has a corresponding MIME type entry", () => {
    for (const extension of ALLOWED_DOCUMENT_FILE_EXTENSIONS) {
      expect(DOCUMENT_MIME_TYPE_BY_EXTENSION[extension]).toBeTruthy();
    }
  });

  test("the size label matches the byte constant it describes", () => {
    expect(MAX_WORKER_DOCUMENT_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_WORKER_DOCUMENT_FILE_SIZE_LABEL).toBe("10 MB");
  });

  test("the per-batch file limit is a positive, sane ceiling", () => {
    expect(MAX_FILES_PER_UPLOAD_BATCH).toBeGreaterThan(0);
    expect(MAX_FILES_PER_UPLOAD_BATCH).toBeLessThanOrEqual(50);
  });
});
