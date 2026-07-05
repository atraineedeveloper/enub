import type { QueryClient } from "@tanstack/react-query";

export const workerDocumentKeys = {
  all: ["workerDocuments"],
  catalog: () => [...workerDocumentKeys.all, "catalog"],
  worker: (workerId: number) => [...workerDocumentKeys.all, "worker", workerId],
  workerDocuments: (workerId: number) => [
    ...workerDocumentKeys.worker(workerId),
    "documents",
  ],
  workerSemesterDocuments: (workerId: number, semesterId: number | string) => [
    ...workerDocumentKeys.worker(workerId),
    "documents",
    "semester",
    semesterId,
  ],
  report: (workerId: number, semesterId: number | string | null = null) => [
    ...workerDocumentKeys.worker(workerId),
    "report",
    semesterId ?? "all",
  ],
  signedUrl: (storagePath: string) => [
    ...workerDocumentKeys.all,
    "signedUrl",
    storagePath,
  ],
};

export function invalidateWorkerDocumentQueries(
  queryClient: QueryClient,
  workerId?: number | null
) {
  queryClient.invalidateQueries({ queryKey: workerDocumentKeys.catalog() });

  if (!workerId) {
    queryClient.invalidateQueries({ queryKey: workerDocumentKeys.all });
    return;
  }

  queryClient.invalidateQueries({
    queryKey: workerDocumentKeys.worker(workerId),
  });
}
