import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Static SPA: `vite build` → dist/ (Vercel rewrites every path to index.html, see vercel.json).
export default defineConfig(({ command, mode }) => {
  const { VITE_API_BASE_URL: apiBase, MOCK_API_CALL: mockRaw } = loadEnv(mode, process.cwd(), [
    "VITE_",
    "MOCK_",
  ]);
  const mock = mockRaw?.toLowerCase() === "true";
  // Static host has no same-origin API → a build without a backend URL would lose every signup.
  // Mock builds are exempt (no network calls).
  if (command === "build" && !apiBase && !mock) {
    throw new Error(
      "VITE_API_BASE_URL is required for builds (see docs/backend_contracts.md). Set it, or MOCK_API_CALL=true.",
    );
  }
  return {
    // MOCK_API_CALL is exposed to the client too (see src/lib/api.ts).
    envPrefix: ["VITE_", "MOCK_"],
    resolve: { tsconfigPaths: true },
    plugins: [tailwindcss(), viteReact()],
  };
});
