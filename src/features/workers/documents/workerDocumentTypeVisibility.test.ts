import { describe, expect, test } from "bun:test";
import {
  filterVisibleDocumentTypes,
  isDocumentTypeVisibleForWorker,
} from "./workerDocumentTypeVisibility";
import type { WorkerDocument } from "./useWorkerDocuments";

function documentsByTypeOf(documents: Partial<WorkerDocument>[]) {
  const map = new Map<number, WorkerDocument[]>();

  for (const document of documents) {
    const typeId = document.document_type_id as number;
    const existing = map.get(typeId) ?? [];
    existing.push(document as WorkerDocument);
    map.set(typeId, existing);
  }

  return map;
}

describe("isDocumentTypeVisibleForWorker / filterVisibleDocumentTypes (union rule)", () => {
  test("an active type is always visible, with or without documents", () => {
    const activeType = { id: 1, is_active: true };
    expect(isDocumentTypeVisibleForWorker(activeType, new Map())).toBe(true);
  });

  test("an inactive type with no documents for this worker is hidden", () => {
    const inactiveType = { id: 1, is_active: false };
    expect(isDocumentTypeVisibleForWorker(inactiveType, new Map())).toBe(
      false
    );
  });

  test("an inactive type with existing documents for this worker remains visible", () => {
    const inactiveType = { id: 1, is_active: false };
    const documentsByType = documentsByTypeOf([
      { document_type_id: 1, id: 100 },
    ]);

    expect(
      isDocumentTypeVisibleForWorker(inactiveType, documentsByType)
    ).toBe(true);
  });

  test("Worker A's historical documents never cause an inactive type to appear for Worker B", () => {
    const inactiveType = { id: 1, is_active: false };

    // Worker A's own documentsByType map has a row under the inactive type.
    const workerADocumentsByType = documentsByTypeOf([
      { document_type_id: 1, id: 100, worker_id: 1 },
    ]);
    // Worker B's own map is built solely from Worker B's own documents and
    // has no row under that type at all.
    const workerBDocumentsByType = documentsByTypeOf([]);

    expect(
      isDocumentTypeVisibleForWorker(inactiveType, workerADocumentsByType)
    ).toBe(true);
    expect(
      isDocumentTypeVisibleForWorker(inactiveType, workerBDocumentsByType)
    ).toBe(false);
  });

  test("filterVisibleDocumentTypes applies the rule per-type across a full category list", () => {
    const documentTypes = [
      { id: 1, is_active: true },
      { id: 2, is_active: false },
      { id: 3, is_active: false },
    ];
    const documentsByType = documentsByTypeOf([
      { document_type_id: 3, id: 200 },
    ]);

    const visible = filterVisibleDocumentTypes(documentTypes, documentsByType);

    expect(visible.map((documentType) => documentType.id)).toEqual([1, 3]);
  });
});
