import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OptionsApp } from "./OptionsApp";
import "./options.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Options root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>
);
