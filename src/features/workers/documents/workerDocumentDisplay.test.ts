import { describe, expect, test } from "bun:test";
import {
  formatWorkerDocumentFileSize,
  getWorkerDocumentFileExtension,
} from "./workerDocumentDisplay";

describe("getWorkerDocumentFileExtension", () => {
  test("returns the uppercased extension", () => {
    expect(getWorkerDocumentFileExtension("evidencia.pdf")).toBe("PDF");
  });

  test("returns an empty string for a file with no extension", () => {
    expect(getWorkerDocumentFileExtension("README")).toBe("");
  });

  test("uses only the last segment for a file with multiple dots", () => {
    expect(getWorkerDocumentFileExtension("reporte.final.v2.docx")).toBe("DOCX");
  });

  test("defaults to an empty string for a missing filename", () => {
    expect(getWorkerDocumentFileExtension()).toBe("");
  });
});

describe("formatWorkerDocumentFileSize", () => {
  test("bytes under 1 KB show as whole bytes", () => {
    expect(formatWorkerDocumentFileSize(500)).toBe("500 B");
  });

  test("exactly 1024 bytes rolls over to 1 KB", () => {
    expect(formatWorkerDocumentFileSize(1024)).toBe("1.0 KB");
  });

  test("a value in the KB range shows one decimal", () => {
    expect(formatWorkerDocumentFileSize(2048)).toBe("2.0 KB");
  });

  test("a value in the MB range shows one decimal", () => {
    expect(formatWorkerDocumentFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  test("null, undefined, zero, and negative sizes all return an empty string", () => {
    expect(formatWorkerDocumentFileSize(null)).toBe("");
    expect(formatWorkerDocumentFileSize(undefined)).toBe("");
    expect(formatWorkerDocumentFileSize(0)).toBe("");
    expect(formatWorkerDocumentFileSize(-10)).toBe("");
  });
});
