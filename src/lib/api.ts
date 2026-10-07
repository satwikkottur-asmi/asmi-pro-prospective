import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import {
  API_PATHS,
  type ErrorCode,
  type EventRequest,
  type SignupRequest,
  type SignupResponseFor,
  type Stats,
} from "./api-types";

// Waitlist backend client (types: ./api-types.ts, contract: docs/backend_contracts.md).
// - Base URL: VITE_API_BASE_URL (empty → same origin)
// - Retries: network errors, timeouts, 5xx; 429 only with Retry-After
// - 4xx validation errors are returned, never retried
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 400;

declare module "axios" {
  interface AxiosRequestConfig {
    retries?: number;
    attempt?: number;
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

// MOCK_API_CALL=true (default false) → every request (incl. events' fetch adapter) is answered by src/lib/api-mock.ts.
// Dynamic import + literal flag (vite.config.ts `define`) → mock is dropped from builds when off.
if (import.meta.env.MOCK_API_CALL === "true") {
  api.interceptors.request.use((config) => {
    config.adapter = (c) => import("./api-mock").then((m) => m.mockAdapter(c));
    return config;
  });
}

function retryAfterMs(error: AxiosError) {
  const header = error.response?.headers["retry-after"];
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

function isRetryable(error: AxiosError) {
  const status = error.response?.status;
  if (status == null) return error.code !== "ERR_CANCELED"; // network error or timeout
  if (status === 429) return retryAfterMs(error) != null;
  return status >= 500;
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config;
  if (!config) throw error;
  const attempt = config.attempt ?? 0;
  if (attempt >= (config.retries ?? MAX_RETRIES) || !isRetryable(error)) throw error;
  const backoff = BASE_DELAY_MS * 2 ** attempt + Math.random() * BASE_DELAY_MS;
  await new Promise((resolve) => setTimeout(resolve, retryAfterMs(error) ?? backoff));
  return api.request({ ...config, attempt: attempt + 1 });
});

// ok=true → typed success body; ok=false → backend error code when it sent one.
export type SignupResult<T> = { ok: true; data: T } | { ok: false; error?: ErrorCode | undefined };

const errorCode = (data: unknown) =>
  (data as { error?: ErrorCode } | undefined)?.error ?? undefined;

// Resolves for any HTTP response (ok=false on 4xx/5xx); rejects only when the request never landed.
export async function postSignup<R extends SignupRequest>(
  body: R,
  config: AxiosRequestConfig = {},
): Promise<SignupResult<SignupResponseFor<R>>> {
  try {
    const { data } = await api.post<SignupResponseFor<R>>(API_PATHS.signup, body, config);
    // A 2xx without `ok: true` (e.g. an HTML page) is not a success.
    return data?.ok === true ? { ok: true, data } : { ok: false, error: errorCode(data) };
  } catch (error) {
    const response = axios.isAxiosError(error) ? error.response : undefined;
    if (!response) throw error;
    return { ok: false, error: errorCode(response.data) };
  }
}

export async function getStats() {
  const { data } = await api.get<Stats>(API_PATHS.stats, { retries: 1 });
  // Guards against a 200 HTML fallback page being read as stats.
  if (typeof data?.total !== "number") throw new Error("Unexpected stats response");
  return data;
}

// Backend + database ready? GET /healthz/ → 200 "OK". Never throws; meant to run in the background.
// - 3 attempts total (shared interceptor: exponential backoff on network errors, timeouts, 5xx)
// - 30s per attempt: a cold backend can take 10–15s on the first hit
export async function checkHealth(): Promise<boolean> {
  try {
    const { data } = await api.get<string>(API_PATHS.health, {
      retries: 2,
      timeout: 30_000,
      responseType: "text",
    });
    return String(data).trim() === "OK";
  } catch {
    return false;
  }
}

// Fire-and-forget analytics: no retries (avoid double counts), keepalive survives page unload.
export function postEvent(body: EventRequest) {
  return postSignup(body, { retries: 0, adapter: "fetch", fetchOptions: { keepalive: true } });
}
