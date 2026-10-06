/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Signup API origin; empty → same origin. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
