import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import styled from "styled-components";
import Header from "./Header";
import WorkerNav from "./WorkerNav";
import Spinner from "./Spinner";
import ErrorBoundary from "./ErrorBoundary";

const StyledWorkerAppLayout = styled.div`
  display: grid;
  grid-template-rows: auto auto 1fr;
  min-height: 100vh;
`;

const Main = styled.main`
  background-color: var(--color-grey-50);
  padding: 4rem 4.8rem 6.4rem;
  min-width: 0;

  @media (max-width: 900px) {
    padding: 2.4rem 1.8rem 4.8rem;
  }
`;

// Worker-facing counterpart to AppLayout.tsx: same Header (with its own
// account popover), no admin Sidebar/MainNav -- workers never see staff
// navigation. WorkerNav is a separate, worker-only navigation row (Mis
// documentos / Mi horario / Mi información), not a reuse or extension of
// the admin Sidebar/MainNav.
function WorkerAppLayout() {
  return (
    <StyledWorkerAppLayout>
      <Header />
      <WorkerNav />
      <Main>
        <Suspense fallback={<Spinner />}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </Suspense>
      </Main>
    </StyledWorkerAppLayout>
  );
}

export default WorkerAppLayout;
