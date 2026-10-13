import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppExperience, AppRecoveryBoundary } from "./AppExperience";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppRecoveryBoundary><AppExperience><App /></AppExperience></AppRecoveryBoundary>
    </BrowserRouter>
  </StrictMode>,
);
