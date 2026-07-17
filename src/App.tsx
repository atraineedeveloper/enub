import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { lazy, Suspense } from "react";
import { Toaster } from "react-hot-toast";

import { DarkModeProvider } from "./context/DarkModeContext";
import GlobalStyles from "./styles/GlobalStyles";
import ProtectedRoute from "./ui/ProtectedRoute";
import RoleGate from "./ui/RoleGate";
import { buildWorkerRouteBranch, buildPendingAccessBranch } from "./ui/workerRouteBranch";
import SpinnerFullPage from "./ui/SpinnerFullPage";

const PageNotFound = lazy(() => import("./pages/PageNotFound"));
const Degrees = lazy(() => import("./pages/Records/Degrees"));
const AppLayout = lazy(() => import("./ui/AppLayout"));
const WorkerAppLayout = lazy(() => import("./ui/WorkerAppLayout"));
const Subjects = lazy(() => import("./pages/Records/Subjects"));
const Groups = lazy(() => import("./pages/Records/Groups"));
const Semesters = lazy(() => import("./pages/Semesters"));
const ScheduleDashboard = lazy(() => import("./pages/ScheduleDashboard"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const StudyPrograms = lazy(() => import("./pages/Records/StudyPrograms"));
const StateRoles = lazy(() => import("./pages/Records/StateRoles"));
const Others = lazy(() => import("./pages/Records/Others"));
const Workers = lazy(() => import("./pages/Records/Workers"));
const WorkerDocuments = lazy(() => import("./pages/Records/WorkerDocuments"));
const Roles = lazy(() => import("./pages/Records/Roles"));
const Login = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const MyDocuments = lazy(() => import("./pages/MyDocuments"));
const MySchedule = lazy(() => import("./pages/MySchedule"));
const MyProfile = lazy(() => import("./pages/MyProfile"));
const PendingAccess = lazy(() => import("./pages/PendingAccess"));
const SetPassword = lazy(() => import("./pages/SetPassword"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      // staleTime: 0,
    },
  },
});

function App() {
  return (
    <DarkModeProvider>
      <GlobalStyles />
      <QueryClientProvider client={queryClient}>
        <ReactQueryDevtools initialIsOpen={false} />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Suspense fallback={<SpinnerFullPage />}>
            <Routes>
              <Route
                element={
                  <ProtectedRoute>
                    <RoleGate>
                      <AppLayout />
                    </RoleGate>
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate replace to="dashboard" />} />
                <Route path="degrees" element={<Degrees />} />
                <Route path="subjects" element={<Subjects />} />
                <Route path="groups" element={<Groups />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="study-programs" element={<StudyPrograms />} />
                <Route path="state-roles" element={<StateRoles />} />
                <Route path="roles" element={<Roles />} />
                <Route path="others" element={<Others />} />
                <Route path="semesters" element={<Semesters />} />
                <Route path="workers" element={<Workers />} />
                <Route
                  path="workers/:id/documents"
                  element={<WorkerDocuments />}
                />
                <Route path="semesters/:id" element={<ScheduleDashboard />} />
                <Route path="*" element={<PageNotFound />} />
              </Route>

              {/* Authorization (role/profile-linkage) is resolved by
                  WorkerRouteGate BEFORE WorkerAppLayout -- and therefore
                  Header/WorkerNav/any page content -- ever mounts, so an
                  admin/staff/unauthorized session never renders so much as
                  a flash of worker navigation (audit finding: route-branch
                  gating). pending-access is deliberately a sibling of this
                  whole group, still behind ProtectedRoute only -- it is the
                  gate's own denial target, so it can never be nested inside
                  the thing that denies access to it. Both branches are
                  built by buildWorkerRouteBranch/buildPendingAccessBranch
                  (workerRouteBranch.tsx) -- the SAME function
                  workerRouteBranchRender.test.tsx renders directly, so the
                  test exercises this exact construction, not a hand-copied
                  approximation of it. */}
              {buildWorkerRouteBranch({
                workerAppLayout: <WorkerAppLayout />,
                myDocuments: <MyDocuments />,
                mySchedule: <MySchedule />,
                myProfile: <MyProfile />,
              })}

              {buildPendingAccessBranch(<PendingAccess />)}

              <Route path="login" element={<Login />} />
              {/* Not wrapped in ProtectedRoute: a worker requesting recovery
                  is by definition not authenticated yet. */}
              <Route path="forgot-password" element={<ForgotPassword />} />
              {/* Not wrapped in ProtectedRoute: this is the landing page for
                  an invitation/recovery link. The page itself checks for a
                  session (via useUser) and shows its own "invalid/expired
                  link" state rather than being redirected to /login before
                  that check can happen. */}
              <Route path="set-password" element={<SetPassword />} />
            </Routes>
          </Suspense>
        </BrowserRouter>

        <Toaster
          position="top-center"
          gutter={12}
          containerStyle={{ margin: "8px" }}
          toastOptions={{
            success: {
              duration: 3000,
            },
            error: {
              duration: 5000,
            },
            style: {
              fontSize: "16px",
              maxWidth: "500px",
              padding: "16px 24px",
              backgroundColor: "var(--color-grey-0)",
              color: "var(--color-grey-700)",
            },
          }}
        />
      </QueryClientProvider>
    </DarkModeProvider>
  );
}

export default App;
