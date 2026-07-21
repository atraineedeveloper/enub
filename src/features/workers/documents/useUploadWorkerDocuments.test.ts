import { describe, expect, test } from "bun:test";
import {
  buildBatchSummary,
  buildQueueItem,
  canStartUpload,
  getDiscardableItems,
  getPendingItems,
  removeCompletedItems,
  removeQueueItem,
  runUploadQueue,
  updateQueueItem,
  type UploadQueueItem,
  type WorkerDocumentUploader,
} from "./useUploadWorkerDocuments";

function makeFile(name: string, size = 100): File {
  return new File(["x".repeat(size)], name, { type: "application/pdf" });
}

function makeItem(
  name: string,
  status: UploadQueueItem["status"] = "preparado"
): UploadQueueItem {
  return { ...buildQueueItem(makeFile(name)), status };
}

describe("buildQueueItem", () => {
  test("wraps a File as a preparado item with a stable, unique id", () => {
    const file = makeFile("a.pdf");
    const item = buildQueueItem(file);

    expect(item.file).toBe(file);
    expect(item.status).toBe("preparado");
    expect(item.id).toBeTruthy();
  });

  test("two items for two different files never share an id", () => {
    const first = buildQueueItem(makeFile("a.pdf"));
    const second = buildQueueItem(makeFile("b.pdf"));
    expect(first.id).not.toBe(second.id);
  });
});

describe("updateQueueItem / removeQueueItem (pure array transforms, no mutation)", () => {
  test("updateQueueItem patches only the matching item, leaving others untouched", () => {
    const items = [makeItem("a.pdf"), makeItem("b.pdf")];
    const updated = updateQueueItem(items, items[0].id, { status: "subiendo" });

    expect(updated[0].status).toBe("subiendo");
    expect(updated[1].status).toBe("preparado");
    expect(items[0].status).toBe("preparado"); // original array untouched
  });

  test("updateQueueItem against an id not present in the array is a no-op copy", () => {
    const items = [makeItem("a.pdf")];
    const updated = updateQueueItem(items, "does-not-exist", { status: "error" });
    expect(updated).toEqual(items);
    expect(updated).not.toBe(items);
  });

  test("removeQueueItem drops exactly the matching item", () => {
    const items = [makeItem("a.pdf"), makeItem("b.pdf"), makeItem("c.pdf")];
    const remaining = removeQueueItem(items, items[1].id);

    expect(remaining).toHaveLength(2);
    expect(remaining.map((item) => item.file.name)).toEqual(["a.pdf", "c.pdf"]);
  });
});

describe("getPendingItems", () => {
  test("returns only preparado items, in original order", () => {
    const items = [
      makeItem("a.pdf", "completado"),
      makeItem("b.pdf", "preparado"),
      makeItem("c.pdf", "error"),
      makeItem("d.pdf", "preparado"),
    ];
    expect(getPendingItems(items).map((item) => item.file.name)).toEqual([
      "b.pdf",
      "d.pdf",
    ]);
  });

  test("an empty queue yields an empty pending list", () => {
    expect(getPendingItems([])).toEqual([]);
  });
});

describe("canStartUpload (double-submit guard predicate)", () => {
  test("refuses to start while already uploading, even with pending items", () => {
    expect(canStartUpload(true, 3)).toBe(false);
  });

  test("refuses to start with zero actionable items", () => {
    expect(canStartUpload(false, 0)).toBe(false);
  });

  test("allows starting when idle and at least one item is actionable", () => {
    expect(canStartUpload(false, 1)).toBe(true);
  });

  test("a second click while the first batch is still in flight is refused (doble clic no duplica)", () => {
    // Models exactly the isBatchInFlightRef state during an in-progress
    // upload: isUploading is already true by the time a second click's
    // handler runs.
    expect(canStartUpload(/* isUploading */ true, /* pendingCount */ 5)).toBe(
      false
    );
  });
});

describe("buildBatchSummary (éxito total / éxito parcial / error total)", () => {
  test("éxito total, 1 archivo", () => {
    expect(buildBatchSummary(1, 0)).toEqual({
      variant: "success",
      message: "El documento se subió con éxito",
    });
  });

  test("éxito total, varios archivos", () => {
    expect(buildBatchSummary(4, 0)).toEqual({
      variant: "success",
      message: "Los 4 archivos se subieron con éxito",
    });
  });

  test("error total, 1 archivo", () => {
    expect(buildBatchSummary(0, 1)).toEqual({
      variant: "error",
      message: "El documento no pudo subirse",
    });
  });

  test("error total, varios archivos", () => {
    expect(buildBatchSummary(0, 3)).toEqual({
      variant: "error",
      message: "No se pudo subir ninguno de los 3 archivos",
    });
  });

  test("éxito parcial: never claims full success or full failure", () => {
    const summary = buildBatchSummary(2, 3);
    expect(summary.variant).toBe("partial");
    expect(summary.message).toBe(
      "2 de 5 archivos se subieron con éxito; 3 tuvieron un error"
    );
  });
});

describe("getDiscardableItems (lo que realmente se perdería al descartar)", () => {
  test("preparado activa el guard -- cuenta como descartable", () => {
    const items = [makeItem("a.pdf", "preparado")];
    expect(getDiscardableItems(items)).toEqual(items);
  });

  test("error activa el guard -- cuenta como descartable (reintentable o descartable)", () => {
    const items = [makeItem("a.pdf", "error")];
    expect(getDiscardableItems(items)).toEqual(items);
  });

  test("completado nunca activa el guard -- ya se subió, no hay nada que perder", () => {
    const items = [makeItem("a.pdf", "completado")];
    expect(getDiscardableItems(items)).toEqual([]);
  });

  test("subiendo tampoco cuenta como descartable (isBusy ya bloquea el cierre por su cuenta)", () => {
    const items = [makeItem("a.pdf", "subiendo")];
    expect(getDiscardableItems(items)).toEqual([]);
  });

  test("el contador coincide exactamente con lo realmente descartable en una cola mixta", () => {
    const items = [
      makeItem("a.pdf", "completado"),
      makeItem("b.pdf", "preparado"),
      makeItem("c.pdf", "error"),
      makeItem("d.pdf", "completado"),
      makeItem("e.pdf", "error"),
    ];
    expect(getDiscardableItems(items).map((i) => i.file.name)).toEqual([
      "b.pdf",
      "c.pdf",
      "e.pdf",
    ]);
    expect(getDiscardableItems(items)).toHaveLength(3);
  });
});

describe("removeCompletedItems (limpieza tras asentarse un lote)", () => {
  test("elimina únicamente los items completado, conserva preparado y error", () => {
    const items = [
      makeItem("a.pdf", "completado"),
      makeItem("b.pdf", "preparado"),
      makeItem("c.pdf", "error"),
    ];
    const remaining = removeCompletedItems(items);
    expect(remaining.map((i) => i.file.name)).toEqual(["b.pdf", "c.pdf"]);
  });

  test("una cola enteramente completado queda vacía", () => {
    const items = [makeItem("a.pdf", "completado"), makeItem("b.pdf", "completado")];
    expect(removeCompletedItems(items)).toEqual([]);
  });

  test("no muta el arreglo original", () => {
    const items = [makeItem("a.pdf", "completado")];
    const original = [...items];
    removeCompletedItems(items);
    expect(items).toEqual(original);
  });
});

describe("Ciclo completo de la cola: éxito total / parcial / error total (runUploadQueue + removeCompletedItems)", () => {
  async function runBatchAndSweep(
    items: UploadQueueItem[],
    uploadFile: WorkerDocumentUploader
  ) {
    let current = items;
    const onItemUpdate = (itemId: string, patch: Partial<UploadQueueItem>) => {
      current = updateQueueItem(current, itemId, patch);
    };
    const result = await runUploadQueue(
      current,
      { workerId: 1, documentTypeId: 1, semesterId: null },
      uploadFile,
      onItemUpdate
    );
    current = removeCompletedItems(current);
    return { result, finalItems: current };
  }

  test("éxito total: la cola queda vacía -- el guard de descarte nunca se activa al cerrar", async () => {
    const items = [makeItem("a.pdf"), makeItem("b.pdf")];
    const uploadFile: WorkerDocumentUploader = async () => ({ worker_id: 1 } as never);

    const { finalItems } = await runBatchAndSweep(items, uploadFile);

    expect(finalItems).toEqual([]);
    expect(getDiscardableItems(finalItems)).toHaveLength(0);
  });

  test("éxito parcial: conserva únicamente los archivos que fallaron", async () => {
    const items = [makeItem("ok.pdf"), makeItem("fails.pdf"), makeItem("ok2.pdf")];
    const uploadFile: WorkerDocumentUploader = async ({ file }) => {
      if (file.name === "fails.pdf") throw new Error("El archivo no pudo subirse");
      return { worker_id: 1 } as never;
    };

    const { finalItems } = await runBatchAndSweep(items, uploadFile);

    expect(finalItems.map((i) => i.file.name)).toEqual(["fails.pdf"]);
    expect(finalItems.every((i) => i.status === "error")).toBe(true);
    expect(getDiscardableItems(finalItems)).toHaveLength(1);
  });

  test("error total: conserva todos los archivos fallidos, ninguno se pierde de la cola", async () => {
    const items = [makeItem("a.pdf"), makeItem("b.pdf")];
    const uploadFile: WorkerDocumentUploader = async () => {
      throw new Error("El archivo no pudo subirse");
    };

    const { finalItems } = await runBatchAndSweep(items, uploadFile);

    expect(finalItems).toHaveLength(2);
    expect(finalItems.every((i) => i.status === "error")).toBe(true);
    expect(getDiscardableItems(finalItems)).toHaveLength(2);
  });

  test("confirmar descarte solo limpia items locales (preparado/error) -- nunca invoca ninguna eliminación de documentos ya cargados", async () => {
    // "Descartar" en este módulo es exclusivamente una operación sobre el
    // arreglo local `items` (removeQueueItem/clearQueue-equivalent) -- no
    // existe ninguna llamada a deleteWorkerDocument ni a ninguna mutación
    // de servidor en este archivo. Lo único verificable aquí es que el
    // conjunto "descartable" nunca incluye completado (que sí representa
    // un documento ya cargado, con fila real en worker_documents).
    const items = [
      makeItem("cargado.pdf", "completado"),
      makeItem("pendiente.pdf", "preparado"),
      makeItem("fallido.pdf", "error"),
    ];

    const discardable = getDiscardableItems(items);

    expect(discardable.map((i) => i.file.name)).toEqual(["pendiente.pdf", "fallido.pdf"]);
    expect(discardable.some((i) => i.file.name === "cargado.pdf")).toBe(false);
  });
});

describe("runUploadQueue (sequential, per-file status transitions, no cross-file transaction)", () => {
  test("éxito total: every item transitions preparado -> subiendo -> completado", async () => {
    const items = [makeItem("a.pdf"), makeItem("b.pdf")];
    const transitions: Array<{ id: string; status: string }> = [];
    const uploadFile: WorkerDocumentUploader = async ({ file }) => ({
      id: 1,
      worker_id: 42,
      document_type_id: 1,
      semester_id: null,
      file_name: file.name,
      storage_path: `x/${file.name}`,
      mime_type: "application/pdf",
      file_size: file.size,
      uploaded_by: null,
      created_at: "2026-07-20T00:00:00.000Z",
    } as never);

    const result = await runUploadQueue(
      items,
      { workerId: 7, documentTypeId: 1, semesterId: 3 },
      uploadFile,
      (itemId, patch) => transitions.push({ id: itemId, status: String(patch.status) })
    );

    expect(result).toEqual({ successCount: 2, errorCount: 0, lastSuccessfulWorkerId: 42 });
    expect(transitions).toEqual([
      { id: items[0].id, status: "subiendo" },
      { id: items[0].id, status: "completado" },
      { id: items[1].id, status: "subiendo" },
      { id: items[1].id, status: "completado" },
    ]);
  });

  test("error total: every item transitions to error, none to completado", async () => {
    const items = [makeItem("a.pdf"), makeItem("b.pdf")];
    const uploadFile: WorkerDocumentUploader = async () => {
      throw new Error("El archivo debe ser PDF, Word, Excel o una imagen válida");
    };

    const statuses: string[] = [];
    const result = await runUploadQueue(
      items,
      { workerId: 7, documentTypeId: 1, semesterId: 3 },
      uploadFile,
      (_id, patch) => statuses.push(String(patch.status))
    );

    expect(result.successCount).toBe(0);
    expect(result.errorCount).toBe(2);
    expect(statuses.filter((status) => status === "completado")).toHaveLength(0);
    expect(statuses.filter((status) => status === "error")).toHaveLength(2);
  });

  test("éxito parcial: a rejected file does not stop the remaining files from being attempted", async () => {
    const items = [makeItem("a.pdf"), makeItem("fails.pdf"), makeItem("c.pdf")];
    const attempted: string[] = [];
    const uploadFile: WorkerDocumentUploader = async ({ file }) => {
      attempted.push(file.name);
      if (file.name === "fails.pdf") throw new Error("El archivo no pudo subirse");
      return { worker_id: 7 } as never;
    };

    const result = await runUploadQueue(
      items,
      { workerId: 7, documentTypeId: 1, semesterId: null },
      uploadFile,
      () => {}
    );

    // All 3 files were attempted -- the middle failure did not short-circuit
    // the loop -- and the final counts reflect the true mixed outcome.
    expect(attempted).toEqual(["a.pdf", "fails.pdf", "c.pdf"]);
    expect(result).toEqual({ successCount: 2, errorCount: 1, lastSuccessfulWorkerId: 7 });
  });

  test("carries the error message from the rejected upload onto the item", async () => {
    const items = [makeItem("bad.pdf")];
    const uploadFile: WorkerDocumentUploader = async () => {
      throw new Error("El archivo no debe pesar más de 10 MB");
    };
    const patches: Array<Partial<UploadQueueItem>> = [];

    await runUploadQueue(
      items,
      { workerId: 1, documentTypeId: 1, semesterId: null },
      uploadFile,
      (_id, patch) => patches.push(patch)
    );

    const errorPatch = patches.find((patch) => patch.status === "error");
    expect(errorPatch?.errorMessage).toBe("El archivo no debe pesar más de 10 MB");
  });

  test("only preparado items are uploaded -- completado/error items already in the array are skipped", async () => {
    const items = [
      makeItem("already-done.pdf", "completado"),
      makeItem("new.pdf", "preparado"),
    ];
    const attempted: string[] = [];
    const uploadFile: WorkerDocumentUploader = async ({ file }) => {
      attempted.push(file.name);
      return { worker_id: 1 } as never;
    };

    await runUploadQueue(
      items,
      { workerId: 1, documentTypeId: 1, semesterId: null },
      uploadFile,
      () => {}
    );

    expect(attempted).toEqual(["new.pdf"]);
  });

  test("an empty preparado set uploads nothing and reports zero/zero", async () => {
    const uploadFile: WorkerDocumentUploader = async () => {
      throw new Error("should never be called");
    };

    const result = await runUploadQueue(
      [makeItem("done.pdf", "completado")],
      { workerId: 1, documentTypeId: 1, semesterId: null },
      uploadFile,
      () => {}
    );

    expect(result).toEqual({ successCount: 0, errorCount: 0, lastSuccessfulWorkerId: undefined });
  });
});
