export const workerDocumentKeys = {
  all: ["workerDocuments"],
  catalog: () => [...workerDocumentKeys.all, "catalog"],
  worker: (workerId) => [...workerDocumentKeys.all, "worker", workerId],
  workerDocuments: (workerId) => [
    ...workerDocumentKeys.worker(workerId),
    "documents",
  ],
  workerSemesterDocuments: (workerId, semesterId) => [
    ...workerDocumentKeys.worker(workerId),
    "documents",
    "semester",
    semesterId,
  ],
  report: (workerId, semesterId = null) => [
    ...workerDocumentKeys.worker(workerId),
    "report",
    semesterId ?? "all",
  ],
  signedUrl: (storagePath) => [
    ...workerDocumentKeys.all,
    "signedUrl",
    storagePath,
  ],
};

export function invalidateWorkerDocumentQueries(queryClient, workerId) {
  queryClient.invalidateQueries({ queryKey: workerDocumentKeys.catalog() });

  if (!workerId) {
    queryClient.invalidateQueries({ queryKey: workerDocumentKeys.all });
    return;
  }

  queryClient.invalidateQueries({
    queryKey: workerDocumentKeys.worker(workerId),
  });
}
