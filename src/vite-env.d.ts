/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Signup API origin; empty → same origin. */
  readonly VITE_API_BASE_URL?: string;
  /** Public site origin for absolute link-preview URLs (build-time, index.html only). */
  readonly VITE_SITE_URL?: string;
  /** "true" → answer API calls in the browser with src/lib/api-mock.ts. Normalized in vite.config.ts. */
  readonly MOCK_API_CALL: "true" | "false";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
