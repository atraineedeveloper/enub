import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getWorkerDocumentsBySemester } from "../../../services/apiWorkerDocuments";
import { workerDocumentKeys } from "./workerDocumentKeys";
import type { WorkerDocument } from "./useWorkerDocuments";

// placeholderData: keepPreviousData is the actual fix for "selectedCategoryId
// resets when the semester changes" (see documentRequirementSummary.ts's
// resolveActiveCategoryId for the defensive half of that fix). Without it,
// switching to a semester with no cached data yet makes `isLoading` go
// true again (a genuinely new query key), and WorkerDocumentsView swaps its
// whole subtree to <Spinner/> while it's true -- unmounting
// WorkerDocumentsDashboard and destroying its local state, including
// selectedCategoryId. With it, the previous semester's documents (and
// `isLoading = false`) are kept on screen while the new semester's request
// is in flight, so the dashboard never unmounts for a refetch that already
// has usable data -- only the true first load (no cached data for any
// semester yet) still shows isLoading = true.
// isPlaceholderData/isFetching are surfaced explicitly (not just isLoading)
// so a caller can distinguish "no data for any period yet" (isLoading) from
// "showing the previous period's data while the new period's request is in
// flight" (isPlaceholderData) -- the latter is the exact window during
// which WorkerDocumentsView must treat the dataset as read-only (see
// isUpdatingSemesterData there): `workerDocuments` still holds a valid
// object, but it belongs to a DIFFERENT semesterId than the one currently
// selected, so acting on it (opening the drawer, mutating) would operate
// against the wrong period's data.
export function useWorkerDocumentsBySemester(
  workerId: number,
  semesterId: number | string
) {
  const {
    isLoading,
    isFetching,
    isPlaceholderData,
    data: workerDocuments,
    error,
  } = useQuery<WorkerDocument[]>({
    queryKey: workerDocumentKeys.workerSemesterDocuments(workerId, semesterId),
    queryFn: () => getWorkerDocumentsBySemester(workerId, semesterId),
    enabled: Boolean(workerId && semesterId),
    placeholderData: keepPreviousData,
  });

  return { isLoading, isFetching, isPlaceholderData, error, workerDocuments };
}
