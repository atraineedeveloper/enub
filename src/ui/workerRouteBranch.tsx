import type { ReactElement, ReactNode } from "react";
import { Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import WorkerRouteGate from "./WorkerRouteGate";
import PendingAccessLayout from "./PendingAccessLayout";

// The exact worker-branch route construction App.tsx renders, extracted
// into a plain function so a test can build the IDENTICAL <Route> tree
// (not a hand-rolled parallel copy that could silently drift from the
// real wiring) and render it with a real renderer -- see
// workerRouteBranchRender.test.tsx. Called directly as
// `{buildWorkerRouteBranch(...)}` inside <Routes> (not
// `<BuildWorkerRouteBranch />`), so react-router's createRoutesFromChildren
// sees the literal <Route> elements this returns, exactly as if they were
// written inline in App.tsx.
//
// `workerAppLayout` is accepted as an already-built element (App.tsx
// passes its existing `lazy(() => import("./ui/WorkerAppLayout"))`
// reference, unchanged) rather than imported directly here, specifically
// so this extraction does not change WorkerAppLayout's code-splitting --
// App.tsx keeps deciding whether it's lazy or eager. The test file passes
// a directly-imported (non-lazy) WorkerAppLayout instead, since a
// synchronous renderer can't resolve a Suspense-lazy component in one pass
// -- that's a test-only concern, not a production bundling change.
export function buildWorkerRouteBranch(input: {
  workerAppLayout: ReactElement;
  myDocuments: ReactNode;
  mySchedule: ReactNode;
  myProfile: ReactNode;
}) {
  return (
    <Route
      element={
        <ProtectedRoute>
          <WorkerRouteGate />
        </ProtectedRoute>
      }
    >
      <Route element={input.workerAppLayout}>
        <Route path="my-documents" element={input.myDocuments} />
        <Route path="my-schedule" element={input.mySchedule} />
        <Route path="my-profile" element={input.myProfile} />
      </Route>
    </Route>
  );
}

// /pending-access is deliberately NOT part of buildWorkerRouteBranch above
// -- it is WorkerRouteGate's own denial target, so it must be a sibling
// route tree, never nested inside the branch that denies access to it.
export function buildPendingAccessBranch(pendingAccessPage: ReactNode) {
  return (
    <Route
      element={
        <ProtectedRoute>
          <PendingAccessLayout />
        </ProtectedRoute>
      }
    >
      <Route path="pending-access" element={pendingAccessPage} />
    </Route>
  );
}
