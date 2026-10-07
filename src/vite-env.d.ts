/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Signup API origin; empty → same origin. */
  readonly VITE_API_BASE_URL?: string;
  /** "true" (case-insensitive; default false) → answer API calls in the browser with src/lib/api-mock.ts. */
  readonly MOCK_API_CALL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
