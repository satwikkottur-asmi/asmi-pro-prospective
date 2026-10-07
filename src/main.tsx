import "./styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { checkHealth } from "./lib/api";
import { routes } from "./routes";

// Dev only: say early when the local backend is down instead of failing on the first signup.
if (import.meta.env.DEV && import.meta.env.MOCK_API_CALL !== "true") {
  checkHealth().then((ok) => {
    if (!ok)
      console.warn(
        `[hoys] Backend not ready at ${import.meta.env.VITE_API_BASE_URL || "(same origin)"}/healthz/.`,
        "Start it with `python manage.py runserver`, or set MOCK_API_CALL=true in .env.",
      );
  });
}

const queryClient = new QueryClient();
const router = createBrowserRouter(routes);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
