import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { lazy, Suspense } from "react";
import { Toaster } from "react-hot-toast";

import GlobalStyles from "./styles/GlobalStyles";
import ProtectedRoute from "./ui/ProtectedRoute";
import SpinnerFullPage from "./ui/SpinnerFullPage";

const PageNotFound = lazy(() => import("./pages/PageNotFound"));
const Degrees = lazy(() => import("./pages/Records/Degrees"));
const AppLayout = lazy(() => import("./ui/AppLayout"));
const Subjects = lazy(() => import("./pages/Records/Subjects"));
const Groups = lazy(() => import("./pages/Records/Groups"));
const Semesters = lazy(() => import("./pages/Semesters"));
const ScheduleDashboard = lazy(() => import("./pages/ScheduleDashboard"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const StudyPrograms = lazy(() => import("./pages/Records/StudyPrograms"));
const StateRoles = lazy(() => import("./pages/Records/StateRoles"));
const Others = lazy(() => import("./pages/Records/Others"));
const Workers = lazy(() => import("./pages/Records/Workers"));
const Roles = lazy(() => import("./pages/Records/Roles"));
const Login = lazy(() => import("./pages/Login"));

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
    <>
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
                    <AppLayout />
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
                <Route path="semesters/:id" element={<ScheduleDashboard />} />
                <Route path="*" element={<PageNotFound />} />
              </Route>

              <Route path="login" element={<Login />} />
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
    </>
  );
}

export default App;
