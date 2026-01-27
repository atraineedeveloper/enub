import { Outlet } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import styled from "styled-components";

const StyledAppLayout = styled.div`
  display: grid;
  grid-template-columns: 26rem 1fr;
  grid-template-rows: auto 1fr;
  min-height: 100vh;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Main = styled.main`
  background-color: var(--color-grey-50);
  padding: 4rem 4.8rem 6.4rem;

  @media (max-width: 900px) {
    padding: 2.4rem 1.8rem 4.8rem;
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
`;

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleToggleSidebar = () => setIsSidebarOpen((open) => !open);
  const handleCloseSidebar = () => setIsSidebarOpen(false);

  return (
    <StyledAppLayout>
      <Header onToggleSidebar={handleToggleSidebar} />
      <SidebarOverlay $isOpen={isSidebarOpen} onClick={handleCloseSidebar} />
      <Sidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} />
      <Main onClick={handleCloseSidebar}>
        <Outlet />
      </Main>
    </StyledAppLayout>
  );
}

export default AppLayout;
