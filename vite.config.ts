import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

// Absolute URLs in index.html link-preview tags (FB/iMessage ignore relative og:image).
// - `__SITE_URL__` → VITE_SITE_URL, else Vercel's production domain, else "" (relative, local builds)
// - og:url is added only when the site URL is known
function siteUrlPlugin(siteUrl: string): Plugin {
  return {
    name: "site-url",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => ({
        html: html.replaceAll("__SITE_URL__", siteUrl),
        tags: siteUrl
          ? [
              {
                tag: "meta",
                attrs: { property: "og:url", content: `${siteUrl}/` },
                injectTo: "head",
              },
            ]
          : [],
      }),
    },
  };
}

// Static SPA: `vite build` → dist/ (Vercel rewrites every path to index.html, see vercel.json).
export default defineConfig(({ command, mode }) => {
  const {
    VITE_API_BASE_URL: apiBase,
    VITE_SITE_URL: siteEnv,
    MOCK_API_CALL: mockRaw,
  } = loadEnv(mode, process.cwd(), ["VITE_", "MOCK_"]);
  const vercelHost = process.env["VERCEL_PROJECT_PRODUCTION_URL"];
  const siteUrl = (siteEnv || (vercelHost ? `https://${vercelHost}` : "")).replace(/\/$/, "");
  const mock = mockRaw?.toLowerCase() === "true";
  // Static host has no same-origin API → a build without a backend URL would lose every signup.
  // Mock builds are exempt (no network calls).
  if (command === "build" && !apiBase && !mock) {
    throw new Error(
      "VITE_API_BASE_URL is required for builds (see docs/backend_contracts.md). Set it, or MOCK_API_CALL=true.",
    );
  }
  return {
    // MOCK_API_CALL → client as a literal "true"/"false":
    // - only this one var is exposed (no `MOCK_` envPrefix)
    // - literal lets the build drop the mock import when off (src/lib/api.ts)
    define: { "import.meta.env.MOCK_API_CALL": JSON.stringify(String(mock)) },
    resolve: { tsconfigPaths: true },
    plugins: [tailwindcss(), viteReact(), siteUrlPlugin(siteUrl)],
  };
});
