import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { initDensityWatcher } from "./store/density";
import { initThemeWatcher } from "./store/theme";
import "./index.css";

// Applied before the first render so there's no flash of the wrong
// theme, and kept subscribed for the app's lifetime so switching the
// OS theme live-updates a "system"-mode session without a reload.
initThemeWatcher();
initDensityWatcher();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>
);
