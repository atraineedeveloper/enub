// Pure logic for the document-manager dashboard: grouping documents by
// type, computing the progress summary, per-row action/status labels,
// filtering/search, sort order, and the drawer's safe-close predicate.
// Nothing here touches React, Supabase, or the upload orchestration --
// every function is directly unit testable in isolation
// (documentRequirementSummary.test.ts), matching this codebase's
// established pure-module/thin-component split.

import type {
  WorkerDocumentCategory,
  WorkerDocumentType,
} from "./useWorkerDocumentCatalog";
import type { WorkerDocument } from "./useWorkerDocuments";

// Moved verbatim from WorkerDocumentsView.tsx (previously a local,
// untested function) -- groups a worker's documents by document_type_id.
// This is the single grouping every other function below reads from; it
// is never re-derived per category/scope, because the query layer already
// resolves the correct dataset per scope (see the module comment on
// `documentsByType`'s callers for why a permanent type's rows in this map
// are always its semester_id-null rows, and a semester type's rows are
// always the currently-selected semester's rows -- by construction of
// `getWorkerDocumentsBySemester`'s own filter, unchanged by this feature).
export function getDocumentsByType(
  documents: WorkerDocument[] = []
): Map<number, WorkerDocument[]> {
  return documents.reduce((acc, document) => {
    const documentsForType = acc.get(document.document_type_id) ?? [];
    documentsForType.push(document);
    acc.set(document.document_type_id, documentsForType);
    return acc;
  }, new Map<number, WorkerDocument[]>());
}

// The row's secondary "estado/cantidad" text -- deliberately never
// mentions "Completo" (retired this pass): a single-file type with its
// one document and a multi-file type with several documents are both
// just "N archivo(s)", uniformly.
export function getRequirementFileCountLabel(documentCount: number): string {
  if (documentCount === 0) return "Pendiente";
  return `${documentCount} ${documentCount === 1 ? "archivo" : "archivos"}`;
}

// The row's primary action label -- the 5 states approved explicitly:
// inactive-with-history is "Ver archivos" (no upload control at all, see
// DocumentRequirementRow/DocumentDetailDrawer); every active state is a
// pure function of allows_multiple x (has at least one document).
export function getRequirementActionLabel(
  isActive: boolean,
  allowsMultiple: boolean,
  documentCount: number
): string {
  if (!isActive) return "Ver archivos";
  if (documentCount === 0) return allowsMultiple ? "Subir archivos" : "Subir archivo";
  return allowsMultiple ? "Agregar archivos" : "Reemplazar archivo";
}

// The most recent upload's raw created_at (ISO 8601, so plain string
// comparison is chronological order -- no Date object, no timezone
// interpretation), or null when there are no documents yet. The caller
// formats this (formatWorkerDocumentDate) and supplies the "Sin archivos
// cargados" fallback text for null -- this function only resolves *which*
// timestamp is latest.
export function getLatestUploadDate(
  documents: Pick<WorkerDocument, "created_at">[]
): string | null {
  return documents.reduce<string | null>(
    (latest, document) =>
      !latest || document.created_at > latest ? document.created_at : latest,
    null
  );
}

// Deterministic "most recent first" order for the drawer's uploaded-file
// list -- never depends on whatever order Postgres/PostgREST happened to
// return rows in. Ties (identical created_at) break on id descending
// (larger id = inserted later), so the order is always fully determined,
// never a coincidental stable-sort artifact of input order.
export function sortWorkerDocumentsByRecency<
  T extends Pick<WorkerDocument, "id" | "created_at">
>(documents: T[]): T[] {
  return [...documents].sort((a, b) => {
    if (a.created_at !== b.created_at) {
      return a.created_at > b.created_at ? -1 : 1;
    }
    return b.id - a.id;
  });
}

export type DocumentStatusFilter = "all" | "pending" | "withFiles";

// Filters a category's document types by the summary/detail filter chip --
// applied AFTER the existing union-rule visibility filter
// (filterVisibleDocumentTypes), never instead of it.
export function filterRequirementsByStatus<T extends Pick<WorkerDocumentType, "id">>(
  documentTypes: T[],
  documentsByType: Map<number, WorkerDocument[]>,
  filter: DocumentStatusFilter
): T[] {
  if (filter === "all") return documentTypes;

  return documentTypes.filter((documentType) => {
    const hasFiles = (documentsByType.get(documentType.id)?.length ?? 0) > 0;
    return filter === "withFiles" ? hasFiles : !hasFiles;
  });
}

// Case-insensitive substring match on the requirement's name. An
// empty/whitespace-only search term is a no-op (returns every type
// unfiltered), so clearing the search box always restores the full list.
export function filterRequirementsBySearch<T extends Pick<WorkerDocumentType, "name">>(
  documentTypes: T[],
  searchTerm: string
): T[] {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return documentTypes;
  return documentTypes.filter((documentType) =>
    documentType.name.toLowerCase().includes(normalized)
  );
}

export interface DocumentProgressSummary {
  totalActive: number;
  withFiles: number;
  pending: number;
  // null specifically means "no active requirements exist" -- the only
  // case division-by-zero would otherwise occur. Callers show a distinct,
  // human message for null rather than a 0% or NaN% bar.
  percentage: number | null;
}

// The global summary combines every ACTIVE requirement across every
// category (permanent + every semester category), each counted at most
// once regardless of how many files it has (a requirement with 5 files
// contributes exactly 1 to `withFiles`, the same as one with 1 file).
// Inactive types are displayed elsewhere in the UI (with their historical
// files, "Ver archivos") but are deliberately excluded from BOTH
// `totalActive` and `withFiles`/`pending` here -- they are neither
// "pending" (nothing new can ever be uploaded against them) nor part of
// what "coverage" means going forward.
export function computeDocumentProgressSummary(
  categories: Pick<WorkerDocumentCategory, "document_types">[],
  documentsByType: Map<number, WorkerDocument[]>
): DocumentProgressSummary {
  let totalActive = 0;
  let withFiles = 0;

  for (const category of categories) {
    for (const documentType of category.document_types) {
      if (!documentType.is_active) continue;

      totalActive += 1;
      if ((documentsByType.get(documentType.id)?.length ?? 0) > 0) {
        withFiles += 1;
      }
    }
  }

  return {
    totalActive,
    withFiles,
    pending: totalActive - withFiles,
    percentage:
      totalActive === 0 ? null : Math.round((withFiles / totalActive) * 100),
  };
}

export interface CategoryChangeState {
  documentFilter: DocumentStatusFilter;
  searchTerm: string;
}

// What survives a category switch (approved design decision 3): the
// status filter is a property of "how you like to view any category" and
// persists; the search term is scoped to whatever requirement name you
// were looking for in the PREVIOUS category, and is always cleared.
export function applyCategoryChange(
  currentFilter: DocumentStatusFilter
): CategoryChangeState {
  return { documentFilter: currentFilter, searchTerm: "" };
}

export type DrawerCloseGuard = "allow" | "confirm" | "block";

// The single predicate every close/navigate-away trigger (X, Escape,
// overlay click, switching requirement, switching category, switching
// semester) is funneled through: an active upload blocks outright (the
// user cannot lose track of an in-flight request); an unresolved local
// selection (queued-but-not-uploaded files, or a single-file pick that
// hasn't been confirmed) requires an explicit confirmation before it's
// discarded; otherwise closing is immediate.
export function getDrawerCloseGuard(
  isBusy: boolean,
  hasPendingSelection: boolean
): DrawerCloseGuard {
  if (isBusy) return "block";
  if (hasPendingSelection) return "confirm";
  return "allow";
}

export type DrawerTransitionDecision = "run" | "confirm" | "ignore";

// What a close/navigate-away request (X, Escape, overlay, switching
// requirement/category, changing semester) actually does, given whether
// the drawer is even open and its last-reported close guard: closed ->
// always runs immediately, nothing to guard; open + "block" -> silently
// ignored (an active upload cannot be interrupted); open + "allow" -> runs
// immediately; open + "confirm" -> the caller must show the
// discard-pending-uploads confirmation and defer the action until the
// user decides.
export function decideDrawerTransition(
  drawerOpen: boolean,
  guard: DrawerCloseGuard
): DrawerTransitionDecision {
  if (!drawerOpen) return "run";
  if (guard === "block") return "ignore";
  if (guard === "allow") return "run";
  return "confirm";
}
