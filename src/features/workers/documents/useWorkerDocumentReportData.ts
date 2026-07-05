import { useQuery } from "@tanstack/react-query";
import { getWorkerDocumentReportData } from "../../../services/apiWorkerDocuments";
import { workerDocumentKeys } from "./workerDocumentKeys";
import type { WorkerDocumentCategory, WorkerDocumentType } from "./useWorkerDocumentCatalog";
import type { WorkerDocument } from "./useWorkerDocuments";
import type { Semester } from "../../semesters/useSemesters";
import type { Worker } from "../useWorkers";

export type WorkerDocumentReportWorker = Pick<
  Worker,
  "id" | "name" | "RFC" | "type_worker" | "status"
>;

export interface WorkerDocumentReportDocumentType extends WorkerDocumentType {
  documents: WorkerDocument[];
  status: "Cargado" | "Pendiente";
  uploaded_at: string | null;
  file_name: string | null;
}

export interface WorkerDocumentReportCategory
  extends Omit<WorkerDocumentCategory, "document_types"> {
  document_types: WorkerDocumentReportDocumentType[];
}

export interface WorkerDocumentReportData {
  worker: WorkerDocumentReportWorker;
  semester: Semester | null;
  categories: WorkerDocumentReportCategory[];
}

// getWorkerDocumentReportData is untyped JS (out of scope) whose `semesterId`
// param has a plain default (`= null`), so TS's allowJs inference narrows it
// to `null | undefined` alone -- same class of friction as
// createEditWorkers's `options` param (Phase 2, useCreateWorker.ts).
const getReportData = getWorkerDocumentReportData as (
  workerId: number,
  semesterId?: number | string | null
) => Promise<WorkerDocumentReportData>;

export function useWorkerDocumentReportData(
  workerId: number,
  semesterId: number | string | null = null
) {
  const {
    isLoading,
    data: reportData,
    error,
  } = useQuery<WorkerDocumentReportData>({
    queryKey: workerDocumentKeys.report(workerId, semesterId),
    queryFn: () => getReportData(workerId, semesterId),
    enabled: Boolean(workerId),
  });

  return { isLoading, error, reportData };
}
