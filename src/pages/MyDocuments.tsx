import { useGatedWorkerId } from "../features/authentication/useGatedWorkerId";
import WorkerDocumentsView from "../features/workers/documents/WorkerDocumentsView";
import SpinnerFullPage from "../ui/SpinnerFullPage";

// Gating (loading -> staff/admin redirect -> invalid-link redirect) lives
// above this page, at the route-branch level (App.tsx's WorkerRouteGate
// layout route), not inline here. WorkerDocumentsView.tsx still requires
// an explicit workerId prop (intentionally not modified by this change),
// so it is resolved here via the shared, session-derived
// useGatedWorkerId() -- never from the URL or an arbitrary prop. The null
// case below is not reachable in practice (WorkerRouteGate above already
// guarantees a valid link before this page ever mounts) but is handled
// explicitly rather than assumed, so this component is never asked to
// hand WorkerDocumentsView an invalid id.
function MyDocuments() {
  const workerId = useGatedWorkerId();
  if (workerId === null) return <SpinnerFullPage />;
  return <WorkerDocumentsView workerId={workerId} />;
}

export default MyDocuments;
