import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../styles/index.css";
import { ManagePage } from "./ManagePage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ManagePage />
  </StrictMode>
);
