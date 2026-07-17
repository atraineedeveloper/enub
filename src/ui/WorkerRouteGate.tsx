import { Navigate, Outlet } from "react-router-dom";
import { useProfile } from "../features/authentication/useProfile";
import { resolveWorkerRouteGateDecision } from "./workerRouteGateDecision";
import SpinnerFullPage from "./SpinnerFullPage";

// Shared gate for the ENTIRE worker route branch (Mis documentos, Mi
// horario, Mi información): wraps the worker <Route> group itself, above
// WorkerAppLayout, as a layout route (mirrors RoleGate.tsx wrapping
// AppLayout on the admin side). Nothing worker-facing -- not the Header,
// not WorkerNav, not any page content -- renders until authorization is
// resolved: while role/profile linkage is loading, this is the ONLY thing
// on screen (a full-page spinner, the same approved loading state used
// everywhere else authorization is still resolving). Denies admin/staff
// (redirected to /dashboard, never seeing worker navigation), an
// unrecognized role, a missing profiles row, or a worker role with no
// valid worker link (redirected to /pending-access, which is deliberately
// NOT nested under this gate/WorkerAppLayout -- see App.tsx), and
// otherwise renders <Outlet /> so WorkerAppLayout and the worker pages
// beneath it can mount. Worker id is never read here for anything other
// than the boolean validity check -- pages resolve their own workerId
// independently from useProfile()/the identity path, never as a prop this
// gate hands down (design.md §4/§11, hardened per the account-generation
// and route-gating audit findings). The actual branching decision lives in
// the pure, directly-testable resolveWorkerRouteGateDecision.
function WorkerRouteGate() {
  const { isLoading, role, workerId } = useProfile();
  const decision = resolveWorkerRouteGateDecision({ isLoading, role, workerId });

  if (decision.type === "loading") return <SpinnerFullPage />;
  if (decision.type === "redirect") return <Navigate to={decision.to} replace />;
  return <Outlet />;
}

export default WorkerRouteGate;
