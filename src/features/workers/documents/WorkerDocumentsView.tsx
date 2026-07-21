import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import WorkerDocumentsDashboard from "./WorkerDocumentsDashboard";
import { useWorkerDocumentCatalog } from "./useWorkerDocumentCatalog";
import { useWorkerDocumentReportData } from "./useWorkerDocumentReportData";
import { useWorkerDocuments } from "./useWorkerDocuments";
import type { WorkerDocument } from "./useWorkerDocuments";
import { useWorkerDocumentsBySemester } from "./useWorkerDocumentsBySemester";
import { generateWorkerDocumentReportPdf } from "./generateWorkerDocumentReportPdf";
import { getDocumentsByType } from "./documentRequirementSummary";
import { useSemesters } from "../../semesters/useSemesters";
import { useWorker } from "../useWorker";
import ErrorMessage from "../../../ui/ErrorMessage";
import Spinner from "../../../ui/Spinner";
import { getWorkerDocumentSignedUrl } from "../../../services/apiWorkerDocuments";

interface WorkerDocumentsViewProps {
  workerId: number;
}

// Data-fetching/loading/error shell only -- every hook here, and the
// documentsByType/workerDocuments derivation, is unchanged from before the
// dashboard/drawer redesign (Category-scoped dataset separation: a
// permanent category's types only ever see their semester_id-null rows,
// and a semester category's types only ever see the currently-selected
// semester's rows -- both guaranteed by getWorkerDocumentsBySemester's own
// `semester_id.is.null OR semester_id.eq.X` filter, untouched by this
// change). All new UI/interaction state (selected category, selected
// requirement, filters, drawer) lives in WorkerDocumentsDashboard.
function WorkerDocumentsView({ workerId }: WorkerDocumentsViewProps) {
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const {
    worker,
    isLoading: isLoadingWorker,
    error: workerError,
  } = useWorker(workerId);
  const {
    documentCatalog,
    isLoading: isLoadingCatalog,
    error: catalogError,
  } = useWorkerDocumentCatalog();
  const {
    semesters,
    isLoading: isLoadingSemesters,
    error: semestersError,
  } = useSemesters();
  const {
    workerDocuments: allWorkerDocuments,
    isLoading: isLoadingAllDocuments,
    error: allDocumentsError,
  } = useWorkerDocuments(workerId);
  const {
    workerDocuments: semesterWorkerDocuments,
    isLoading: isLoadingSemesterDocuments,
    isPlaceholderData: isSemesterDataPlaceholder,
    error: semesterDocumentsError,
  } = useWorkerDocumentsBySemester(workerId, selectedSemesterId);
  const {
    reportData,
    isLoading: isLoadingReportData,
    error: reportError,
  } = useWorkerDocumentReportData(workerId, selectedSemesterId || null);

  const workerDocuments = selectedSemesterId
    ? semesterWorkerDocuments
    : allWorkerDocuments;
  const documentsByType = useMemo(
    () => getDocumentsByType(workerDocuments ?? []),
    [workerDocuments]
  );

  useEffect(() => {
    if (!selectedSemesterId && semesters?.length) {
      setSelectedSemesterId(String(semesters[0].id));
    }
  }, [selectedSemesterId, semesters]);

  async function handleOpenDocument(storagePath: string) {
    try {
      const signedUrl = await getWorkerDocumentSignedUrl(storagePath);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(
        (error as Error)?.message || "No se pudo abrir el documento"
      );
    }
  }

  async function handleDownloadDocument(document: WorkerDocument) {
    try {
      const signedUrl = await getWorkerDocumentSignedUrl(document.storage_path);
      const response = await fetch(signedUrl);

      if (!response.ok) {
        throw new Error("No se pudo descargar el documento");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = objectUrl;
      link.download = document.file_name;
      link.style.display = "none";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      toast.error(
        (error as Error)?.message || "No se pudo descargar el documento"
      );
    }
  }

  function handleDownloadReport() {
    if (reportError) {
      toast.error(reportError?.message || "No se pudo cargar el reporte");
      return;
    }

    if (!reportData) {
      toast.error("Los datos del reporte aún no están disponibles");
      return;
    }

    try {
      generateWorkerDocumentReportPdf(reportData);
    } catch (error) {
      toast.error(
        (error as Error)?.message || "No se pudo generar el reporte"
      );
    }
  }

  // True only for the genuine first load (no cached data for ANY period
  // yet) -- once placeholderData: keepPreviousData is in play (see
  // useWorkerDocumentsBySemester), isLoadingSemesterDocuments never goes
  // true again for a period change, so this never re-triggers the
  // full-page Spinner for a refetch that already has usable data.
  const isLoading =
    isLoadingWorker ||
    isLoadingCatalog ||
    isLoadingSemesters ||
    isLoadingAllDocuments ||
    (selectedSemesterId && isLoadingSemesterDocuments);
  const error =
    workerError ||
    catalogError ||
    semestersError ||
    allDocumentsError ||
    semesterDocumentsError;

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={error.message} />;
  if (!worker) return <ErrorMessage message="El trabajador no existe." />;

  // isPlaceholderData is true exactly while `semesterWorkerDocuments`
  // still belongs to the PREVIOUS semesterId (keepPreviousData substitutes
  // it until the new period's real data arrives) -- the dashboard must
  // treat itself as read-only for that entire window, since any action
  // taken against `documentsByType` right now would act on the wrong
  // period's documents. Deliberately NOT also derived from isFetching:
  // isFetching also goes true for same-period background refetches (e.g.
  // the cache invalidation that follows a successful upload), which must
  // NOT freeze the UI -- isPlaceholderData is the precise signal for "the
  // displayed dataset belongs to a different query key than the one
  // currently selected," which is the actual risk this guards against.
  const isUpdatingSemesterData = Boolean(selectedSemesterId) && isSemesterDataPlaceholder;

  return (
    <WorkerDocumentsDashboard
      worker={worker}
      workerId={workerId}
      documentCatalog={documentCatalog ?? []}
      documentsByType={documentsByType}
      semesters={semesters ?? []}
      selectedSemesterId={selectedSemesterId}
      onSemesterChange={setSelectedSemesterId}
      isUpdatingSemesterData={isUpdatingSemesterData}
      isLoadingReport={isLoadingReportData}
      onDownloadReport={handleDownloadReport}
      onView={handleOpenDocument}
      onDownload={handleDownloadDocument}
    />
  );
}

export default WorkerDocumentsView;
