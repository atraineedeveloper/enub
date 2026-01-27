import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import GlobalStyles from "./styles/GlobalStyles";
import PageNotFound from "./pages/PageNotFound";
import Degrees from "./pages/Records/Degrees";
import AppLayout from "./ui/AppLayout";
import Subjects from "./pages/Records/Subjects";
import Groups from "./pages/Records/Groups";
import Semesters from "./pages/Semesters";
import ScheduleDashboard from "./pages/ScheduleDashboard";
import Dashboard from "./pages/Dashboard";
import StudyPrograms from "./pages/Records/StudyPrograms";
import { Toaster } from "react-hot-toast";
import StateRoles from "./pages/Records/StateRoles";
import Others from "./pages/Records/Others";
import Workers from "./pages/Records/Workers";
import Roles from "./pages/Records/Roles";
import Login from "./pages/Login";
import ProtectedRoute from "./ui/ProtectedRoute";

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
