import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DarkModeProvider } from "./context/DarkModeContext";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <DarkModeProvider>
        <App />
      </DarkModeProvider>
    </StrictMode>
  );
}
