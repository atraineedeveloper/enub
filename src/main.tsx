import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { registerPwa } from "./pwa/registerPwa";
import ErrorBoundary from "./ui/ErrorBoundary";
import PwaUpdatePrompt from "./ui/PwaUpdatePrompt";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <PwaUpdatePrompt registrar={registerPwa} />
    </ErrorBoundary>
  </StrictMode>
);
