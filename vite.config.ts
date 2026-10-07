import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Static SPA: `vite build` → dist/ (Vercel rewrites every path to index.html, see vercel.json).
export default defineConfig({
  // MOCK_API_CALL is exposed to the client too (see src/lib/api.ts).
  envPrefix: ["VITE_", "MOCK_"],
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), viteReact()],
});
