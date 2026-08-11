import supabase from "./supabase";

export interface WorkerDocumentReconciliationResult {
  matched: number;
  resolved: number;
  failed: number;
  conflicts: number;
  remainingMayExist: boolean;
}

export async function reconcileWorkerDocumentStorage(
  workerId: number
): Promise<WorkerDocumentReconciliationResult> {
  if (!Number.isInteger(workerId) || workerId <= 0) {
    throw new Error("El trabajador es requerido");
  }

  const { data, error } = await supabase.functions.invoke(
    "reconcile-worker-document-storage",
    { body: { workerId } }
  );

  if (error) {
    console.error(error);
    throw new Error("La limpieza pendiente de documentos no pudo reconciliarse");
  }

  return {
    matched: Number(data?.matched ?? 0),
    resolved: Number(data?.resolved ?? 0),
    failed: Number(data?.failed ?? 0),
    conflicts: Number(data?.conflicts ?? 0),
    remainingMayExist: Boolean(data?.remainingMayExist),
  };
}
