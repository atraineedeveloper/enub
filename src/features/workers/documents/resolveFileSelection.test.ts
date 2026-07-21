import { describe, expect, test } from "bun:test";
import {
  isSameQueuedFile,
  resolveFileSelection,
  validateDocumentFileTypeAndSize,
} from "./resolveFileSelection";

function makeFile(
  name: string,
  { size = 100, lastModified = 1 }: { size?: number; lastModified?: number } = {}
): File {
  const file = new File(["x".repeat(size)], name, { type: "application/pdf" });
  Object.defineProperty(file, "lastModified", { value: lastModified });
  return file;
}

describe("validateDocumentFileTypeAndSize", () => {
  test("accepts every allowed extension", () => {
    for (const extension of ["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png", "webp"]) {
      expect(validateDocumentFileTypeAndSize(makeFile(`archivo.${extension}`))).toBeNull();
    }
  });

  test("rejects a disallowed extension", () => {
    const result = validateDocumentFileTypeAndSize(makeFile("virus.exe"));
    expect(result).toContain("no es un tipo de archivo permitido");
  });

  test("rejects a file with no extension", () => {
    expect(validateDocumentFileTypeAndSize(makeFile("README"))).toContain(
      "no es un tipo de archivo permitido"
    );
  });

  test("rejects a file over 10 MB", () => {
    const result = validateDocumentFileTypeAndSize(
      makeFile("grande.pdf", { size: 10 * 1024 * 1024 + 1 })
    );
    expect(result).toContain("pesa más de 10 MB");
  });

  test("accepts a file exactly at the 10 MB boundary", () => {
    expect(
      validateDocumentFileTypeAndSize(makeFile("limite.pdf", { size: 10 * 1024 * 1024 }))
    ).toBeNull();
  });

  test("rejects a zero-byte file", () => {
    expect(validateDocumentFileTypeAndSize(makeFile("vacio.pdf", { size: 0 }))).toContain(
      "pesa más de 10 MB"
    );
  });
});

describe("isSameQueuedFile (dedup key: name + size + lastModified)", () => {
  test("two references to files with identical name/size/lastModified are the same", () => {
    const a = makeFile("evidencia.pdf", { size: 100, lastModified: 555 });
    const b = makeFile("evidencia.pdf", { size: 100, lastModified: 555 });
    expect(isSameQueuedFile(a, b)).toBe(true);
  });

  test("a different name makes them different, even with identical size/lastModified", () => {
    const a = makeFile("a.pdf", { size: 100, lastModified: 555 });
    const b = makeFile("b.pdf", { size: 100, lastModified: 555 });
    expect(isSameQueuedFile(a, b)).toBe(false);
  });

  test("a different size makes them different, even with identical name", () => {
    const a = makeFile("evidencia.pdf", { size: 100, lastModified: 555 });
    const b = makeFile("evidencia.pdf", { size: 200, lastModified: 555 });
    expect(isSameQueuedFile(a, b)).toBe(false);
  });

  test("a different lastModified makes them different, even with identical name/size", () => {
    const a = makeFile("evidencia.pdf", { size: 100, lastModified: 555 });
    const b = makeFile("evidencia.pdf", { size: 100, lastModified: 999 });
    expect(isSameQueuedFile(a, b)).toBe(false);
  });
});

describe("resolveFileSelection (seleccionar cero/uno/varios; duplicados; límite de lote)", () => {
  test("cero archivos resuelve en una selección vacía", () => {
    expect(resolveFileSelection([], [])).toEqual({ accepted: [], errors: [] });
  });

  test("un archivo válido se acepta sin errores", () => {
    const file = makeFile("a.pdf");
    expect(resolveFileSelection([file], [])).toEqual({ accepted: [file], errors: [] });
  });

  test("varios archivos válidos y distintos se aceptan todos", () => {
    const files = [makeFile("a.pdf"), makeFile("b.pdf"), makeFile("c.pdf")];
    const result = resolveFileSelection(files, []);
    expect(result.accepted).toEqual(files);
    expect(result.errors).toEqual([]);
  });

  test("un archivo inválido no bloquea la aceptación de los demás en la misma selección", () => {
    const good1 = makeFile("a.pdf");
    const bad = makeFile("virus.exe");
    const good2 = makeFile("b.pdf");

    const result = resolveFileSelection([good1, bad, good2], []);

    expect(result.accepted).toEqual([good1, good2]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("virus.exe");
  });

  test("selección repetida del mismo archivo (ya en la cola) se rechaza como duplicado", () => {
    const queued = makeFile("evidencia.pdf", { size: 100, lastModified: 555 });
    const reselected = makeFile("evidencia.pdf", { size: 100, lastModified: 555 });

    const result = resolveFileSelection([reselected], [queued]);

    expect(result.accepted).toEqual([]);
    expect(result.errors[0]).toContain("ya se agregó");
  });

  test("dos copias del mismo archivo en una sola selección: solo la primera se acepta", () => {
    const a = makeFile("evidencia.pdf", { size: 100, lastModified: 555 });
    const b = makeFile("evidencia.pdf", { size: 100, lastModified: 555 });

    const result = resolveFileSelection([a, b], []);

    expect(result.accepted).toEqual([a]);
    expect(result.errors).toHaveLength(1);
  });

  test("un archivo con el mismo nombre pero distinto contenido (size/lastModified) no es un duplicado", () => {
    const queued = makeFile("evidencia.pdf", { size: 100, lastModified: 555 });
    const different = makeFile("evidencia.pdf", { size: 250, lastModified: 999 });

    const result = resolveFileSelection([different], [queued]);

    expect(result.accepted).toEqual([different]);
    expect(result.errors).toEqual([]);
  });

  test("respeta el máximo de 10 archivos por lote cuando la cola ya tiene algunos", () => {
    const existing = Array.from({ length: 8 }, (_, i) => makeFile(`existing-${i}.pdf`));
    const incoming = Array.from({ length: 5 }, (_, i) => makeFile(`new-${i}.pdf`));

    const result = resolveFileSelection(incoming, existing);

    // Only 2 slots remain (10 - 8), so only the first 2 incoming files are
    // accepted; the rest produce a single "over the limit" message rather
    // than one message per rejected file.
    expect(result.accepted).toHaveLength(2);
    expect(result.accepted.map((f) => f.name)).toEqual(["new-0.pdf", "new-1.pdf"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("máximo de 10 archivos");
  });

  test("una selección que ya excede el máximo por sí sola acepta solo hasta el límite", () => {
    const incoming = Array.from({ length: 12 }, (_, i) => makeFile(`file-${i}.pdf`));
    const result = resolveFileSelection(incoming, []);

    expect(result.accepted).toHaveLength(10);
    expect(result.errors).toHaveLength(1);
  });

  test("la cola ya llena (10 archivos) rechaza toda nueva selección", () => {
    const existing = Array.from({ length: 10 }, (_, i) => makeFile(`existing-${i}.pdf`));
    const result = resolveFileSelection([makeFile("one-more.pdf")], existing);

    expect(result.accepted).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("máximo de 10 archivos");
  });
});
