import { Outlet } from "react-router-dom";
import { useState, Suspense } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import styled from "styled-components";
import Spinner from "./Spinner";
import ErrorBoundary from "./ErrorBoundary";

const StyledAppLayout = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto 1fr;
  min-height: 100vh;
  position: relative;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Main = styled.main`
  background-color: var(--color-grey-50);
  padding: 4rem 4.8rem 6.4rem;
  grid-column: 2 / 3;
  grid-row: 2 / -1;
  min-width: 0;

  @media (max-width: 900px) {
    padding: 2.4rem 1.8rem 4.8rem;
    grid-column: 1 / -1;
  }
`;

const SidebarOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.35);
  backdrop-filter: blur(2px);
  opacity: ${(props) => (props.$isOpen ? 1 : 0)};
  pointer-events: ${(props) => (props.$isOpen ? "auto" : "none")};
  transition: opacity 0.2s ease;
  z-index: 10;

  @media (min-width: 901px) {
    display: none;
  }
`;

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleToggleSidebar = () => setIsSidebarOpen((open) => !open);
  const handleCloseSidebar = () => setIsSidebarOpen(false);
  const handleNavigate = () => {
    if (window.innerWidth <= 900) setIsSidebarOpen(false);
  };

  return (
    <StyledAppLayout>
      <Header onToggleSidebar={handleToggleSidebar} />
      <SidebarOverlay $isOpen={isSidebarOpen} onClick={handleCloseSidebar} />
      <Sidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} onNavigate={handleNavigate} />
      <Main>
        <Suspense fallback={<Spinner />}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </Suspense>
      </Main>
    </StyledAppLayout>
  );
}

export default AppLayout;
