import { Navigate } from "react-router-dom";
import Spinner from "../ui/Spinner";
import { useProfile } from "../features/authentication/useProfile";
import WorkerDocumentsView from "../features/workers/documents/WorkerDocumentsView";

// workerId is resolved from the session here, never from the URL.
function MyDocuments() {
  const { isLoading, role, workerId } = useProfile();

  if (isLoading) return <Spinner />;

  if (role === "staff" || role === "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  if (!(role === "worker" && workerId != null)) {
    return <Navigate to="/pending-access" replace />;
  }

  return <WorkerDocumentsView workerId={workerId} />;
}

export default MyDocuments;
