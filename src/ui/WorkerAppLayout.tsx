import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import styled from "styled-components";
import Header from "./Header";
import Spinner from "./Spinner";
import ErrorBoundary from "./ErrorBoundary";

const StyledWorkerAppLayout = styled.div`
  display: grid;
  grid-template-rows: auto 1fr;
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
// Logout action), no Sidebar/MainNav -- workers never see staff navigation.
function WorkerAppLayout() {
  return (
    <StyledWorkerAppLayout>
      <Header />
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
