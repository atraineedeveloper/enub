import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Real, executable-render proof of the route/layout composition (audit
// finding: source-order text assertions are not sufficient proof of React
// Router wiring). No new dependency: react-dom/server's
// renderToStaticMarkup runs a real synchronous render of a real
// MemoryRouter tree without needing window/document (verified -- this
// project has no jsdom/happy-dom and none is added here).
//
// This renders buildWorkerRouteBranch/buildPendingAccessBranch --
// App.tsx's OWN route-construction functions (src/ui/workerRouteBranch.tsx)
// -- not a hand-rolled approximation of them, so a real drift in App.tsx's
// actual wiring would fail this test. WorkerRouteGate, WorkerAppLayout,
// PendingAccessLayout, WorkerNav, and ProtectedRoute are all the REAL
// production components. Only two leaves are stubbed, deliberately:
// `useProfile`/`useUser` (so each scenario's role/workerId/auth state is
// set directly rather than requiring a live Supabase session), and
// `Header` (a stable marker stand-in -- Header's OWN identity-resolution
// behavior already has its own dedicated coverage in
// useCurrentIdentity.test.ts; this file's job is proving WHETHER Header
// mounts at all for a given authorization state, not re-testing its
// internals). The three worker pages are stubs for the same reason: their
// own data-fetching correctness is covered by workerScheduleQuery.test.ts/
// workerProfileQuery.test.ts/etc. -- this file proves the gate/layout
// wiring reaches down to whichever route matched.

let nextUser: { isLoading: boolean; isAuthenticated: boolean } = {
  isLoading: false,
  isAuthenticated: true,
};

let nextProfile: { isLoading: boolean; role: string | null; workerId: number | null } = {
  isLoading: false,
  role: null,
  workerId: null,
};

mock.module("../features/authentication/useUser", () => ({
  useUser: () => ({ ...nextUser, user: nextUser.isAuthenticated ? { id: "test-user" } : null }),
}));

mock.module("../features/authentication/useProfile", () => ({
  useProfile: () => ({
    ...nextProfile,
    isError: false,
    isWorker: nextProfile.role === "worker",
    isStaffOrAdmin: nextProfile.role === "staff" || nextProfile.role === "admin",
    isAdmin: nextProfile.role === "admin",
    hasNoAccess: nextProfile.role === null,
  }),
}));

const HEADER_MARKER = "HEADER-MARKER-CONTENT";
mock.module("./Header", () => ({
  default: () => <div data-testid="header-marker">{HEADER_MARKER}</div>,
}));

const { buildWorkerRouteBranch, buildPendingAccessBranch } = await import("./workerRouteBranch");
const { default: WorkerAppLayout } = await import("./WorkerAppLayout");
const { default: SpinnerFullPage } = await import("./SpinnerFullPage");

const PAGE_MY_DOCUMENTS = "PAGE-MY-DOCUMENTS-CONTENT";
const PAGE_MY_SCHEDULE = "PAGE-MY-SCHEDULE-CONTENT";
const PAGE_MY_PROFILE = "PAGE-MY-PROFILE-CONTENT";
const PAGE_PENDING_ACCESS = "PAGE-PENDING-ACCESS-CONTENT";
const PAGE_DASHBOARD = "PAGE-DASHBOARD-CONTENT";
const WORKER_NAV_LABEL = "Navegación de la cuenta del trabajador";

function MyDocumentsStub() {
  return <div data-testid="page-my-documents">{PAGE_MY_DOCUMENTS}</div>;
}
function MyScheduleStub() {
  return <div data-testid="page-my-schedule">{PAGE_MY_SCHEDULE}</div>;
}
function MyProfileStub() {
  return <div data-testid="page-my-profile">{PAGE_MY_PROFILE}</div>;
}
function PendingAccessStub() {
  return <div data-testid="page-pending-access">{PAGE_PENDING_ACCESS}</div>;
}

// The exact loading-state markup WorkerRouteGate renders, captured once so
// the "loading" scenario can assert byte-for-byte equality rather than a
// fragile substring/testid guess against a component with no stable
// text/testid of its own.
const loadingMarkup = renderToStaticMarkup(<SpinnerFullPage />);

function renderWorkerAndPendingBranches(initialPath: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        {buildWorkerRouteBranch({
          workerAppLayout: <WorkerAppLayout />,
          myDocuments: <MyDocumentsStub />,
          mySchedule: <MyScheduleStub />,
          myProfile: <MyProfileStub />,
        })}
        {buildPendingAccessBranch(<PendingAccessStub />)}
        <Route path="dashboard" element={<div data-testid="page-dashboard">{PAGE_DASHBOARD}</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("worker route branch -- real render proof (loading session)", () => {
  test("renders only the loading indicator; no worker layout, nav, or page content", () => {
    nextUser = { isLoading: false, isAuthenticated: true };
    nextProfile = { isLoading: true, role: null, workerId: null };

    const html = renderWorkerAndPendingBranches("/my-schedule");

    expect(html).toBe(loadingMarkup);
    expect(html).not.toContain(HEADER_MARKER);
    expect(html).not.toContain(WORKER_NAV_LABEL);
    expect(html).not.toContain(PAGE_MY_SCHEDULE);
  });
});

describe("worker route branch -- real render proof (valid linked worker)", () => {
  test("renders WorkerAppLayout, WorkerNav, and the requested worker page", () => {
    nextUser = { isLoading: false, isAuthenticated: true };
    nextProfile = { isLoading: false, role: "worker", workerId: 7 };

    const html = renderWorkerAndPendingBranches("/my-schedule");

    expect(html).toContain(HEADER_MARKER);
    expect(html).toContain(WORKER_NAV_LABEL);
    expect(html).toContain(PAGE_MY_SCHEDULE);
    expect(html).not.toContain(PAGE_MY_DOCUMENTS);
    expect(html).not.toContain(PAGE_MY_PROFILE);
    expect(html).not.toContain(PAGE_PENDING_ACCESS);
  });

  test("routes to each of the three worker pages correctly", () => {
    nextUser = { isLoading: false, isAuthenticated: true };
    nextProfile = { isLoading: false, role: "worker", workerId: 7 };

    expect(renderWorkerAndPendingBranches("/my-documents")).toContain(PAGE_MY_DOCUMENTS);
    expect(renderWorkerAndPendingBranches("/my-schedule")).toContain(PAGE_MY_SCHEDULE);
    expect(renderWorkerAndPendingBranches("/my-profile")).toContain(PAGE_MY_PROFILE);
  });
});

describe("worker route branch -- real render proof (admin)", () => {
  test("never renders worker layout, nav, or page content", () => {
    nextUser = { isLoading: false, isAuthenticated: true };
    nextProfile = { isLoading: false, role: "admin", workerId: null };

    const html = renderWorkerAndPendingBranches("/my-schedule");

    expect(html).not.toContain(HEADER_MARKER);
    expect(html).not.toContain(WORKER_NAV_LABEL);
    expect(html).not.toContain(PAGE_MY_SCHEDULE);
    expect(html).not.toContain(PAGE_DASHBOARD); // single-pass SSR does not
    // follow the <Navigate> side effect -- the exact redirect DESTINATION
    // ("/dashboard") is asserted by workerRouteGateDecision.test.ts's pure
    // decision tests; this render test's scope is proving non-leakage.
  });
});

describe("worker route branch -- real render proof (staff)", () => {
  test("never renders worker layout, nav, or page content", () => {
    nextUser = { isLoading: false, isAuthenticated: true };
    nextProfile = { isLoading: false, role: "staff", workerId: null };

    const html = renderWorkerAndPendingBranches("/my-schedule");

    expect(html).not.toContain(HEADER_MARKER);
    expect(html).not.toContain(WORKER_NAV_LABEL);
    expect(html).not.toContain(PAGE_MY_SCHEDULE);
  });
});

describe("worker route branch -- real render proof (missing profile / invalid worker link)", () => {
  test("a missing profiles row (role null) never renders worker layout/nav/content", () => {
    nextUser = { isLoading: false, isAuthenticated: true };
    nextProfile = { isLoading: false, role: null, workerId: null };

    const html = renderWorkerAndPendingBranches("/my-schedule");

    expect(html).not.toContain(HEADER_MARKER);
    expect(html).not.toContain(WORKER_NAV_LABEL);
    expect(html).not.toContain(PAGE_MY_SCHEDULE);
  });

  test("an unrecognized role never renders worker layout/nav/content", () => {
    nextUser = { isLoading: false, isAuthenticated: true };
    nextProfile = { isLoading: false, role: "manager", workerId: null };

    const html = renderWorkerAndPendingBranches("/my-schedule");

    expect(html).not.toContain(HEADER_MARKER);
    expect(html).not.toContain(WORKER_NAV_LABEL);
    expect(html).not.toContain(PAGE_MY_SCHEDULE);
  });

  test.each([
    ["zero workerId", 0],
    ["negative workerId", -3],
    ["missing workerId", null],
  ])("a worker role with an invalid link (%s) never renders worker layout/nav/content", (_label, workerId) => {
    nextUser = { isLoading: false, isAuthenticated: true };
    nextProfile = { isLoading: false, role: "worker", workerId };

    const html = renderWorkerAndPendingBranches("/my-schedule");

    expect(html).not.toContain(HEADER_MARKER);
    expect(html).not.toContain(WORKER_NAV_LABEL);
    expect(html).not.toContain(PAGE_MY_SCHEDULE);
  });
});

describe("worker route branch -- real render proof (/pending-access)", () => {
  test("renders PendingAccessLayout's header, never WorkerNav or worker-layout content", () => {
    // pending-access is reached directly by URL, independent of the
    // worker-branch gate's role/workerId state (it's a sibling route tree,
    // not nested inside WorkerRouteGate -- see workerRouteBranch.tsx).
    nextUser = { isLoading: false, isAuthenticated: true };
    nextProfile = { isLoading: false, role: null, workerId: null };

    const html = renderWorkerAndPendingBranches("/pending-access");

    expect(html).toContain(HEADER_MARKER); // PendingAccessLayout's own Header (logout affordance preserved)
    expect(html).toContain(PAGE_PENDING_ACCESS);
    expect(html).not.toContain(WORKER_NAV_LABEL); // no WorkerNav under PendingAccessLayout
    expect(html).not.toContain(PAGE_MY_SCHEDULE);
    expect(html).not.toContain(PAGE_MY_DOCUMENTS);
    expect(html).not.toContain(PAGE_MY_PROFILE);
  });
});
