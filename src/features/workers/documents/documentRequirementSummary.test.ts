import { describe, expect, test } from "bun:test";
import {
  applyCategoryChange,
  canOpenDocumentRequirement,
  computeDocumentProgressSummary,
  decideDrawerTransition,
  filterRequirementsByStatus,
  filterRequirementsBySearch,
  getDocumentsByType,
  getDrawerCloseGuard,
  getLatestUploadDate,
  getRequirementActionLabel,
  getRequirementFileCountLabel,
  resolveActiveCategoryId,
  sortWorkerDocumentsByRecency,
} from "./documentRequirementSummary";
import type { WorkerDocument } from "./useWorkerDocuments";
import type { WorkerDocumentCategory, WorkerDocumentType } from "./useWorkerDocumentCatalog";

function makeDocumentType(overrides: Partial<WorkerDocumentType> = {}): WorkerDocumentType {
  return {
    id: 1,
    category_id: 1,
    name: "Tipo",
    allows_multiple: false,
    is_active: true,
    sort_order: 10,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as WorkerDocumentType;
}

function makeDocument(overrides: Partial<WorkerDocument> = {}): WorkerDocument {
  return {
    id: 1,
    worker_id: 1,
    document_type_id: 1,
    semester_id: null,
    file_name: "archivo.pdf",
    storage_path: "1/1/permanent/uuid-archivo.pdf",
    mime_type: "application/pdf",
    file_size: 100,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as WorkerDocument;
}

describe("getDocumentsByType", () => {
  test("groups documents by document_type_id", () => {
    const docs = [
      makeDocument({ id: 1, document_type_id: 10 }),
      makeDocument({ id: 2, document_type_id: 10 }),
      makeDocument({ id: 3, document_type_id: 20 }),
    ];
    const grouped = getDocumentsByType(docs);
    expect(grouped.get(10)).toHaveLength(2);
    expect(grouped.get(20)).toHaveLength(1);
    expect(grouped.has(30)).toBe(false);
  });

  test("an empty/undefined list yields an empty map", () => {
    expect(getDocumentsByType([]).size).toBe(0);
    expect(getDocumentsByType(undefined).size).toBe(0);
  });
});

describe("getRequirementFileCountLabel", () => {
  test("zero documents -> 'Pendiente'", () => {
    expect(getRequirementFileCountLabel(0)).toBe("Pendiente");
  });

  test("one document -> '1 archivo' (singular, never 'Completo')", () => {
    const label = getRequirementFileCountLabel(1);
    expect(label).toBe("1 archivo");
    expect(label).not.toContain("Completo");
  });

  test("several documents -> plural count", () => {
    expect(getRequirementFileCountLabel(4)).toBe("4 archivos");
  });
});

describe("getRequirementActionLabel (5 estados aprobados)", () => {
  test("multi vacío -> 'Subir archivos'", () => {
    expect(getRequirementActionLabel(true, true, 0)).toBe("Subir archivos");
  });

  test("multi con archivos -> 'Agregar archivos'", () => {
    expect(getRequirementActionLabel(true, true, 3)).toBe("Agregar archivos");
  });

  test("single vacío -> 'Subir archivo'", () => {
    expect(getRequirementActionLabel(true, false, 0)).toBe("Subir archivo");
  });

  test("single con archivo -> 'Reemplazar archivo'", () => {
    expect(getRequirementActionLabel(true, false, 1)).toBe("Reemplazar archivo");
  });

  test("inactivo con historial -> 'Ver archivos', regardless of allows_multiple", () => {
    expect(getRequirementActionLabel(false, true, 5)).toBe("Ver archivos");
    expect(getRequirementActionLabel(false, false, 1)).toBe("Ver archivos");
  });
});

describe("getLatestUploadDate", () => {
  test("returns null for an empty list", () => {
    expect(getLatestUploadDate([])).toBeNull();
  });

  test("returns the single document's date when there is only one", () => {
    expect(getLatestUploadDate([{ created_at: "2026-01-01T00:00:00.000Z" }])).toBe(
      "2026-01-01T00:00:00.000Z"
    );
  });

  test("returns the chronologically latest date, independent of input order", () => {
    const result = getLatestUploadDate([
      { created_at: "2026-01-01T00:00:00.000Z" },
      { created_at: "2026-03-01T00:00:00.000Z" },
      { created_at: "2026-02-01T00:00:00.000Z" },
    ]);
    expect(result).toBe("2026-03-01T00:00:00.000Z");
  });
});

describe("sortWorkerDocumentsByRecency (más recientes primero)", () => {
  test("sorts strictly by created_at descending", () => {
    const docs = [
      makeDocument({ id: 1, created_at: "2026-01-01T00:00:00.000Z" }),
      makeDocument({ id: 2, created_at: "2026-03-01T00:00:00.000Z" }),
      makeDocument({ id: 3, created_at: "2026-02-01T00:00:00.000Z" }),
    ];
    const sorted = sortWorkerDocumentsByRecency(docs);
    expect(sorted.map((d) => d.id)).toEqual([2, 3, 1]);
  });

  test("ties on created_at break deterministically by id descending", () => {
    const docs = [
      makeDocument({ id: 5, created_at: "2026-01-01T00:00:00.000Z" }),
      makeDocument({ id: 9, created_at: "2026-01-01T00:00:00.000Z" }),
      makeDocument({ id: 7, created_at: "2026-01-01T00:00:00.000Z" }),
    ];
    expect(sortWorkerDocumentsByRecency(docs).map((d) => d.id)).toEqual([9, 7, 5]);
  });

  test("never mutates the input array", () => {
    const docs = [
      makeDocument({ id: 1, created_at: "2026-01-01T00:00:00.000Z" }),
      makeDocument({ id: 2, created_at: "2026-02-01T00:00:00.000Z" }),
    ];
    const original = [...docs];
    sortWorkerDocumentsByRecency(docs);
    expect(docs).toEqual(original);
  });
});

describe("filterRequirementsByStatus", () => {
  const types = [
    makeDocumentType({ id: 1, name: "A" }),
    makeDocumentType({ id: 2, name: "B" }),
    makeDocumentType({ id: 3, name: "C" }),
  ];
  const documentsByType = new Map([[1, [makeDocument({ document_type_id: 1 })]]]);

  test("'all' returns every type unfiltered", () => {
    expect(filterRequirementsByStatus(types, documentsByType, "all")).toEqual(types);
  });

  test("'withFiles' keeps only types with at least one document", () => {
    const result = filterRequirementsByStatus(types, documentsByType, "withFiles");
    expect(result.map((t) => t.id)).toEqual([1]);
  });

  test("'pending' keeps only types with zero documents", () => {
    const result = filterRequirementsByStatus(types, documentsByType, "pending");
    expect(result.map((t) => t.id)).toEqual([2, 3]);
  });
});

describe("filterRequirementsBySearch", () => {
  const types = [
    makeDocumentType({ id: 1, name: "Planeación semestral" }),
    makeDocumentType({ id: 2, name: "Rúbricas" }),
    makeDocumentType({ id: 3, name: "Listas de cotejo" }),
  ];

  test("empty search term returns every type unfiltered", () => {
    expect(filterRequirementsBySearch(types, "")).toEqual(types);
    expect(filterRequirementsBySearch(types, "   ")).toEqual(types);
  });

  test("matches case-insensitively by substring", () => {
    const result = filterRequirementsBySearch(types, "LISTAS");
    expect(result.map((t) => t.id)).toEqual([3]);
  });

  test("a term matching nothing returns an empty list", () => {
    expect(filterRequirementsBySearch(types, "xyz")).toEqual([]);
  });
});

describe("computeDocumentProgressSummary", () => {
  function category(documentTypes: WorkerDocumentType[]): Pick<WorkerDocumentCategory, "document_types"> {
    return { document_types: documentTypes };
  }

  test("counts a requirement as covered once it has at least one file -- more files never increment progress twice", () => {
    const categories = [
      category([
        makeDocumentType({ id: 1, allows_multiple: true }),
      ]),
    ];
    const documentsByType = new Map([
      [1, [makeDocument({ id: 1 }), makeDocument({ id: 2 }), makeDocument({ id: 3 })]],
    ]);

    const summary = computeDocumentProgressSummary(categories, documentsByType);
    expect(summary).toEqual({ totalActive: 1, withFiles: 1, pending: 0 });
  });

  test("inactive types are excluded from the denominator entirely -- not counted as pending, not counted as covered", () => {
    const categories = [
      category([
        makeDocumentType({ id: 1, is_active: true }),
        makeDocumentType({ id: 2, is_active: false }), // historical, no files checked
      ]),
    ];
    const documentsByType = new Map<number, WorkerDocument[]>();

    const summary = computeDocumentProgressSummary(categories, documentsByType);
    expect(summary.totalActive).toBe(1);
    expect(summary.pending).toBe(1);
  });

  test("an inactive type WITH historical documents still does not count toward withFiles or totalActive", () => {
    const categories = [
      category([makeDocumentType({ id: 1, is_active: false })]),
    ];
    const documentsByType = new Map([[1, [makeDocument({ id: 1 })]]]);

    const summary = computeDocumentProgressSummary(categories, documentsByType);
    expect(summary).toEqual({ totalActive: 0, withFiles: 0, pending: 0 });
  });

  test("combines every category (permanente + semestrales) into one summary", () => {
    const categories = [
      category([makeDocumentType({ id: 1 })]),
      category([makeDocumentType({ id: 2 }), makeDocumentType({ id: 3 })]),
    ];
    const documentsByType = new Map([[2, [makeDocument({ id: 1 })]]]);

    const summary = computeDocumentProgressSummary(categories, documentsByType);
    expect(summary.totalActive).toBe(3);
    expect(summary.withFiles).toBe(1);
    expect(summary.pending).toBe(2);
  });

  test("zero active requirements -> all counts are zero, no percentage field at all", () => {
    const summary = computeDocumentProgressSummary([], new Map());
    expect(summary).toEqual({ totalActive: 0, withFiles: 0, pending: 0 });
    expect(summary).not.toHaveProperty("percentage");
  });
});

describe("getDrawerCloseGuard", () => {
  test("an active upload blocks closing outright, even with no other pending selection", () => {
    expect(getDrawerCloseGuard(true, false)).toBe("block");
  });

  test("an active upload blocks even if there is also a pending selection -- block wins", () => {
    expect(getDrawerCloseGuard(true, true)).toBe("block");
  });

  test("a pending selection with no active upload requires confirmation", () => {
    expect(getDrawerCloseGuard(false, true)).toBe("confirm");
  });

  test("no pending selection and no active upload closes immediately", () => {
    expect(getDrawerCloseGuard(false, false)).toBe("allow");
  });
});

describe("applyCategoryChange (filtro persiste, búsqueda se limpia)", () => {
  test("the status filter is carried over unchanged", () => {
    expect(applyCategoryChange("withFiles").documentFilter).toBe("withFiles");
    expect(applyCategoryChange("pending").documentFilter).toBe("pending");
    expect(applyCategoryChange("all").documentFilter).toBe("all");
  });

  test("the search term is always cleared, regardless of the current filter", () => {
    expect(applyCategoryChange("all").searchTerm).toBe("");
    expect(applyCategoryChange("withFiles").searchTerm).toBe("");
  });
});

describe("decideDrawerTransition", () => {
  test("the drawer being closed always runs the action immediately, regardless of guard", () => {
    expect(decideDrawerTransition(false, "allow")).toBe("run");
    expect(decideDrawerTransition(false, "confirm")).toBe("run");
    expect(decideDrawerTransition(false, "block")).toBe("run");
  });

  test("an open drawer with an active upload ignores the request (subida activa impide cerrar)", () => {
    expect(decideDrawerTransition(true, "block")).toBe("ignore");
  });

  test("an open drawer with a pending selection requires confirmation", () => {
    expect(decideDrawerTransition(true, "confirm")).toBe("confirm");
  });

  test("an open drawer with nothing pending runs the action immediately", () => {
    expect(decideDrawerTransition(true, "allow")).toBe("run");
  });
});

describe("resolveActiveCategoryId", () => {
  const categories = [{ id: 10 }, { id: 20 }, { id: 30 }];

  test("keeps the selection when it still names a category in the list", () => {
    expect(resolveActiveCategoryId(categories, 20)).toBe(20);
  });

  test("falls back to the first category when selectedCategoryId is null", () => {
    expect(resolveActiveCategoryId(categories, null)).toBe(10);
  });

  test("falls back to the first category when the selected id no longer exists in the catalog", () => {
    expect(resolveActiveCategoryId(categories, 999)).toBe(10);
  });

  test("a NEW array reference containing the same ids keeps the same selection -- never resets just because the reference changed", () => {
    const sameIdsNewArray = categories.map((category) => ({ ...category }));
    expect(resolveActiveCategoryId(sameIdsNewArray, 20)).toBe(20);
  });

  test("an empty catalog resolves to null", () => {
    expect(resolveActiveCategoryId([], 20)).toBeNull();
    expect(resolveActiveCategoryId([], null)).toBeNull();
  });
});

describe("canOpenDocumentRequirement", () => {
  test("returns false while a semester change's data is still resolving (placeholderData) -- the logical guard itself, not just a disabled DOM attribute", () => {
    // Called directly, the same way it would be reached by any caller of
    // openRequirement regardless of how that call arrived (a real click on
    // an enabled button is only ONE such path) -- this is what makes "no
    // drawer opens during isUpdatingSemesterData" hold even for a call
    // that reaches openRequirement programmatically, not through a native
    // click a disabled attribute could have suppressed.
    expect(canOpenDocumentRequirement({ isUpdatingSemesterData: true })).toBe(false);
  });

  test("returns true once the semester's data is settled", () => {
    expect(canOpenDocumentRequirement({ isUpdatingSemesterData: false })).toBe(true);
  });
});
