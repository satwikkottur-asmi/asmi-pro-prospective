import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart({
      // src/server.ts wraps the SSR handler with a branded error page.
      server: { entry: "server" },
      importProtection: { behavior: "error", client: { specifiers: ["server-only"] } },
    }),
    // Cloudflare Workers bundle; build-only so dev stays on Vite's server.
    command === "build" && nitro({ preset: "cloudflare-module", cloudflare: { nodeCompat: true } }),
    viteReact(),
  ],
}));
