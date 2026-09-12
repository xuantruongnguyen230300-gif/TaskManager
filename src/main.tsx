// Font Nunito đóng gói sẵn (app offline): subset latin, latin-ext, vietnamese; đậm 500–800.
import "@fontsource/nunito/latin-500.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "@fontsource/nunito/latin-ext-500.css";
import "@fontsource/nunito/latin-ext-600.css";
import "@fontsource/nunito/latin-ext-700.css";
import "@fontsource/nunito/latin-ext-800.css";
import "@fontsource/nunito/vietnamese-500.css";
import "@fontsource/nunito/vietnamese-600.css";
import "@fontsource/nunito/vietnamese-700.css";
import "@fontsource/nunito/vietnamese-800.css";
import "./styles/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "./app/providers";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <AppProviders />
    </StrictMode>,
  );
}
