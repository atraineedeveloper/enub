import { Outlet } from "react-router-dom";
import styled from "styled-components";
import Header from "./Header";

const StyledPendingAccessLayout = styled.div`
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

// A deliberately minimal layout for /pending-access only: the shared
// Header (so a pending session can still see the account popover/Logout
// action), but never WorkerNav -- that bar links to /my-documents,
// /my-schedule, /my-profile, none of which this session is authorized to
// use. /pending-access is WorkerRouteGate's own denial target (App.tsx),
// so it cannot be nested inside WorkerRouteGate/WorkerAppLayout without
// being circular; this sibling layout preserves the pre-audit "still has
// a header with a way to log out" behavior without going through the
// worker authorization gate at all.
function PendingAccessLayout() {
  return (
    <StyledPendingAccessLayout>
      <Header />
      <Main>
        <Outlet />
      </Main>
    </StyledPendingAccessLayout>
  );
}

export default PendingAccessLayout;
