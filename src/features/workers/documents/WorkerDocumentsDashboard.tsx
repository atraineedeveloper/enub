import { useState } from "react";
import styled from "styled-components";
import { HiArrowDownTray } from "react-icons/hi2";
import Modal from "../../../ui/Modal";
import { useModal } from "../../../ui/useModal";
import Button from "../../../ui/Button";
import Heading from "../../../ui/Heading";
import Select from "../../../ui/Select";
import DocumentSummary from "./components/DocumentSummary";
import DocumentCategoryTabs from "./components/DocumentCategoryTabs";
import DocumentFilters from "./components/DocumentFilters";
import DocumentRequirementList from "./components/DocumentRequirementList";
import DocumentDetailDrawer from "./components/DocumentDetailDrawer";
import { filterVisibleDocumentTypes } from "./workerDocumentTypeVisibility";
import {
  applyCategoryChange,
  canOpenDocumentRequirement,
  computeDocumentProgressSummary,
  decideDrawerTransition,
  filterRequirementsByStatus,
  filterRequirementsBySearch,
  resolveActiveCategoryId,
  type DocumentStatusFilter,
  type DrawerCloseGuard,
} from "./documentRequirementSummary";
import { formatSemesterPeriodWithCode } from "../../semesters/semesterDisplayLabel";
import type { WorkerDocumentCategory, WorkerDocumentType } from "./useWorkerDocumentCatalog";
import type { WorkerDocument } from "./useWorkerDocuments";
import type { Semester } from "../../semesters/useSemesters";
import type { Worker } from "../useWorkers";

const DISCARD_CONFIRM_MODAL_NAME = "discard-pending-uploads";

const PageContainer = styled.div`
  max-width: 116rem;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

const PageHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.6rem;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid var(--color-grey-200);
`;

const WorkerSummary = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  & span {
    color: var(--color-grey-500);
    font-size: 1.4rem;
  }
`;

const HeaderControls = styled.div`
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1.2rem;
`;

const SelectorGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 18rem;
  max-width: 26rem;

  & label {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--color-grey-600);
  }
`;

const EmptyState = styled.p`
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-200);
  border-radius: 7px;
  padding: 1.6rem;
  color: var(--color-grey-600);
`;

const StyledDiscardConfirm = styled.div`
  width: 40rem;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;

  & p {
    color: var(--color-grey-500);
    margin-bottom: 1.2rem;
  }

  & div {
    display: flex;
    justify-content: flex-end;
    gap: 1.2rem;
  }
`;

interface DiscardUploadsConfirmProps {
  discardableCount: number;
  onConfirmDiscard: () => void;
  onCancelDiscard: () => void;
  onCloseModal?: () => void;
}

// The confirmation shown when the user tries to close the drawer, switch
// requirement, switch category, or change semester while files are queued
// but not yet uploaded -- "Cancelar" here leaves everything exactly as it
// was (drawer stays open, queue intact) AND explicitly discards the
// stashed pending-transition closure (`onCancelDiscard`), so a later,
// unrelated transition request can never accidentally fall back to this
// cancelled one's stale intent; only "Salir sin subir" discards the
// pending selection and completes whatever navigation was requested.
// `discardableCount` is exactly preparado + error items (never completado
// -- those already committed server-side, see
// useUploadWorkerDocuments.getDiscardableItems), so this text always
// matches what would truly be lost.
function DiscardUploadsConfirm({
  discardableCount,
  onConfirmDiscard,
  onCancelDiscard,
  onCloseModal,
}: DiscardUploadsConfirmProps) {
  function handleDiscard() {
    onConfirmDiscard();
    onCloseModal?.();
  }

  function handleCancel() {
    onCancelDiscard();
    onCloseModal?.();
  }

  return (
    <StyledDiscardConfirm>
      <Heading as="h3">Archivos sin subir</Heading>
      <p>
        Tienes {discardableCount} {discardableCount === 1 ? "archivo" : "archivos"} sin
        subir. Si continúas, se perderá esta selección -- los archivos ya
        cargados no se ven afectados.
      </p>
      <div>
        <Button type="button" variation="secondary" onClick={handleCancel}>
          Cancelar
        </Button>
        <Button type="button" variation="danger" onClick={handleDiscard}>
          Salir sin subir
        </Button>
      </div>
    </StyledDiscardConfirm>
  );
}

export interface WorkerDocumentsDashboardProps {
  worker: Pick<Worker, "name" | "type_worker">;
  workerId: number;
  documentCatalog: WorkerDocumentCategory[];
  documentsByType: Map<number, WorkerDocument[]>;
  semesters: Semester[];
  selectedSemesterId: string;
  onSemesterChange: (semesterId: string) => void;
  // True while `documentsByType` still reflects a PREVIOUS semester's
  // documents (placeholderData, see useWorkerDocumentsBySemester/
  // WorkerDocumentsView) -- the whole dashboard becomes read-only for this
  // window: no drawer can open, no row action fires, no new period change
  // can start, "Descargar reporte" is disabled. It never unmounts or hides
  // behind a full-page spinner for this -- category/filters/structure stay
  // exactly as they were, only interaction is suspended.
  isUpdatingSemesterData: boolean;
  isLoadingReport: boolean;
  onDownloadReport: () => void;
  onView: (storagePath: string) => void;
  onDownload: (document: WorkerDocument) => void;
}

// All the new dashboard/list/drawer UI state lives here -- the data layer
// (catalog, documents, semesters, report) is entirely owned and fetched by
// WorkerDocumentsView, unchanged, and passed down as plain props.
function WorkerDocumentsDashboardInner({
  worker,
  workerId,
  documentCatalog,
  documentsByType,
  semesters,
  selectedSemesterId,
  onSemesterChange,
  isUpdatingSemesterData,
  isLoadingReport,
  onDownloadReport,
  onView,
  onDownload,
}: WorkerDocumentsDashboardProps) {
  const { open: openModal } = useModal();

  // Raw selection state, set ONLY by explicit user action
  // (handleSelectCategory) -- starts null and stays null until the user
  // picks a category. resolveActiveCategoryId (below) is the single place
  // that falls back to the first category; this state is never lazily
  // initialized from the catalog itself, so there is exactly one piece of
  // code encoding "what happens with no selection" instead of two that
  // could drift apart.
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [documentFilter, setDocumentFilter] = useState<DocumentStatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [drawerGuard, setDrawerGuard] = useState<DrawerCloseGuard>("allow");
  const [drawerDiscardableCount, setDrawerDiscardableCount] = useState(0);
  const [pendingTransition, setPendingTransition] = useState<(() => void) | null>(null);

  // The EFFECTIVE category shown -- derived at render time, never written
  // back into selectedCategoryId. Keeps the selection by id across
  // whatever caused this render (a semester refetch, a new catalog array
  // reference, a documentsByType change); falls back to the first category
  // only when selectedCategoryId is null or no longer names a category in
  // the current catalog. See resolveActiveCategoryId's own comment -- this
  // must never be paired with a useEffect that writes activeCategoryId
  // back into selectedCategoryId on every catalog change.
  const activeCategoryId = resolveActiveCategoryId(documentCatalog, selectedCategoryId);
  const activeCategory = documentCatalog.find((category) => category.id === activeCategoryId);
  const selectedDocumentType: WorkerDocumentType | undefined = documentCatalog
    .flatMap((category) => category.document_types)
    .find((type) => type.id === selectedDocumentTypeId);

  const progressSummary = computeDocumentProgressSummary(documentCatalog, documentsByType);

  const visibleTypes = activeCategory
    ? filterVisibleDocumentTypes(activeCategory.document_types, documentsByType)
    : [];
  const statusFilteredTypes = filterRequirementsByStatus(visibleTypes, documentsByType, documentFilter);
  const displayedTypes = filterRequirementsBySearch(statusFilteredTypes, searchTerm);

  // The single funnel every close/navigate-away trigger goes through
  // (drawer X/overlay/Escape, switching requirement, switching category,
  // changing semester): decideDrawerTransition (pure, unit tested) turns
  // "is the drawer even open" + "its last-reported guard" into one of
  // run/confirm/ignore -- this function only ever acts on that decision,
  // it never re-derives it.
  function requestDrawerTransition(action: () => void) {
    const decision = decideDrawerTransition(drawerOpen, drawerGuard);

    if (decision === "ignore") return;

    if (decision === "run") {
      action();
      return;
    }

    setPendingTransition(() => action);
    openModal(DISCARD_CONFIRM_MODAL_NAME);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setSelectedDocumentTypeId(null);
    setDrawerGuard("allow");
    setDrawerDiscardableCount(0);
  }

  function openRequirement(documentTypeId: number) {
    // Defense in depth alongside the disabled row buttons themselves
    // (DocumentRequirementList's `disabled` prop): the drawer must never
    // open against a dataset that belongs to a different semester than
    // the one currently selected. canOpenDocumentRequirement is the named,
    // independently unit-tested guard (documentRequirementSummary.ts) --
    // this holds even if a call reaches openRequirement through some path
    // other than a native click on an enabled button.
    if (!canOpenDocumentRequirement({ isUpdatingSemesterData })) return;
    requestDrawerTransition(() => {
      setSelectedDocumentTypeId(documentTypeId);
      setDrawerOpen(true);
    });
  }

  function handleSelectCategory(categoryId: number) {
    if (categoryId === activeCategoryId) return;
    requestDrawerTransition(() => {
      const nextState = applyCategoryChange(documentFilter);
      setSelectedCategoryId(categoryId);
      setDocumentFilter(nextState.documentFilter);
      setSearchTerm(nextState.searchTerm);
      closeDrawer();
    });
  }

  function handleSemesterChange(value: string) {
    // No new period change may start until the current one resolves --
    // defense in depth alongside the disabled <Select> itself.
    if (isUpdatingSemesterData) return;
    requestDrawerTransition(() => {
      // Close the drawer BEFORE changing the period -- it must never stay
      // open showing what's about to become placeholder data for the new
      // semesterId. Both are synchronous state updates batched into the
      // same commit either way, but this ordering documents the required
      // sequence directly in the code.
      closeDrawer();
      onSemesterChange(value);
    });
  }

  function handleDiscardConfirmed() {
    pendingTransition?.();
    setPendingTransition(null);
  }

  // Cancelling never runs the stashed transition -- and clears it
  // outright, so it can never be executed later by anything else (defense
  // in depth: no current code path can trigger that today, since opening
  // the discard dialog always freshly re-stashes the action immediately
  // before opening it, but this removes the possibility categorically
  // rather than relying on that invariant continuing to hold).
  function handleDiscardCancelled() {
    setPendingTransition(null);
  }

  const semesterScopedCategory = activeCategory?.scope === "semester";

  return (
    <PageContainer aria-busy={isUpdatingSemesterData}>
      <PageHeader>
        <WorkerSummary>
          <Heading as="h1">Expediente documental</Heading>
          <span>{worker.name}</span>
          <span>{worker.type_worker}</span>
        </WorkerSummary>

        <HeaderControls>
          {semesterScopedCategory && (
            <SelectorGroup>
              <label htmlFor="semester">Periodo académico</label>
              <Select
                id="semester"
                value={selectedSemesterId}
                onChange={(event) => handleSemesterChange(event.target.value)}
                disabled={isUpdatingSemesterData}
              >
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {formatSemesterPeriodWithCode(semester.semester)}
                  </option>
                ))}
              </Select>
            </SelectorGroup>
          )}
          <Button
            type="button"
            variation="secondary"
            disabled={isLoadingReport || isUpdatingSemesterData}
            onClick={onDownloadReport}
          >
            <HiArrowDownTray /> Descargar reporte
          </Button>
        </HeaderControls>
      </PageHeader>

      <DocumentSummary summary={progressSummary} isUpdatingSemesterData={isUpdatingSemesterData} />

      {documentCatalog.length === 0 ? (
        <EmptyState>No hay catálogo de documentos configurado.</EmptyState>
      ) : (
        <>
          <DocumentCategoryTabs
            categories={documentCatalog}
            selectedCategoryId={activeCategoryId}
            onSelectCategory={handleSelectCategory}
          />

          <DocumentFilters
            filter={documentFilter}
            onFilterChange={setDocumentFilter}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
          />

          <DocumentRequirementList
            documentTypes={displayedTypes}
            documentsByType={documentsByType}
            emptyMessage="No hay requisitos que coincidan con el filtro o la búsqueda actual."
            onOpenRequirement={openRequirement}
            disabled={isUpdatingSemesterData}
          />
        </>
      )}

      {drawerOpen && selectedDocumentType && activeCategory && (
        <DocumentDetailDrawer
          key={selectedDocumentType.id}
          documentType={selectedDocumentType}
          documents={documentsByType.get(selectedDocumentType.id) ?? []}
          workerId={workerId}
          semesterId={
            activeCategory.scope === "semester" ? Number(selectedSemesterId) : null
          }
          onView={onView}
          onDownload={onDownload}
          onGuardChange={(guard, discardableCount) => {
            setDrawerGuard(guard);
            setDrawerDiscardableCount(discardableCount);
          }}
          onRequestClose={() => requestDrawerTransition(closeDrawer)}
        />
      )}

      <Modal.Window name={DISCARD_CONFIRM_MODAL_NAME} title="Archivos sin subir">
        <DiscardUploadsConfirm
          discardableCount={drawerDiscardableCount}
          onConfirmDiscard={handleDiscardConfirmed}
          onCancelDiscard={handleDiscardCancelled}
        />
      </Modal.Window>
    </PageContainer>
  );
}

// A dedicated <Modal> provider for this dashboard's own overlays (the
// discard-pending-uploads confirmation, plus every per-file "Eliminar"
// confirmation nested inside the drawer) -- the same provider/consumer
// pattern already used by the rest of this feature, just now also relied
// on by DocumentDetailDrawer's useModal() call to detect when a Modal
// window is open on top of it (see that file's Escape handling).
function WorkerDocumentsDashboard(props: WorkerDocumentsDashboardProps) {
  return (
    <Modal>
      <WorkerDocumentsDashboardInner {...props} />
    </Modal>
  );
}

export default WorkerDocumentsDashboard;
