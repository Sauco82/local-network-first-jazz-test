import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@repo/app";
import "./index.css";

const apiKey = import.meta.env.VITE_JAZZ_API_KEY;
const runtime = navigator.userAgent.toLowerCase().includes("electron")
  ? "desktop"
  : "web";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App apiKey={apiKey} runtime={runtime} />
  </StrictMode>,
);
